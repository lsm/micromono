var Url = require('url')
var type = require('socketmq/lib/message/type')
var debug = require('debug')('micromono:channel:pipe')
var toArray = require('lodash.toarray')
var socketmq = require('socketmq')
var Superpipe = require('superpipe')


var INF = type.INF
var ACK = type.ACK
var LVE = type.LVE
var REQ = type.REQ
var REP = type.REP
var SUB = type.SUB
var MCH = type.MCH
var CKE = type.CKE
var SSN = type.SSN
var SID = type.SID
var reservedNames = ['pub', 'pubChn', 'sub', 'req',
    'reqChn', 'rep', 'chnAdapter', 'chnRepEvents']


exports.normalizeChannels = function(channel) {
  var chn = {}
  // This service only contains one channel definition
  if (channel.namespace) {
    chn[channel.namespace] = channel
  } else {
    // Multiple namespaced channels, set namespace value to individual channel
    // definition object
    Object.keys(channel).forEach(function(namespace) {
      channel[namespace].namespace = namespace
    })
    chn = channel
  }

  return {
    channels: chn
  }
}

exports.checkChannelPropertyName = function(channels, service) {
  function check(obj) {
    Object.keys(obj).forEach(function(name) {
      if (reservedNames.indexOf(name) > -1) {
        var e = new Error('Property name "' + name + '" is reserved for channel.')
        debug(e.stack)
        process.exit(-1)
      }
    })
  }
  Object.keys(channels).forEach(function(namespace) {
    check(channels[namespace])
  })
  check(service)
}

exports.createChannelAdapters = function(channels, service) {
  var chnBackend = socketmq()
  var chnAdapters = {}

  Object.keys(channels).forEach(function(namespace) {
    chnAdapters[namespace] = chnBackend.channel(namespace)
  })

  // Add channel methods and chnBackend to service instance
  service.getChnAdapter = function(namespace) {
    var chn = chnAdapters[namespace]
    if (!chn) {
      debug('[%s] service has no channel for namespace "%s"', service.name, namespace)
      process.exit(-1)
    }
    return chn
  }

  service.pub = function(namespace) {
    var args = toArray(arguments)
    var adapter = this.getChnAdapter(namespace)
    adapter.pubChn.apply(adapter, args.slice(1))
    return this
  }

  service.chnBackend = chnBackend

  return {
    chnBackend: chnBackend,
    chnAdapters: chnAdapters
  }
}

exports.setupChannels = function(channels, chnAdapters, initChannel, service, next) {
  var pipeline = Superpipe()
    .set(exports)
    .set('service', service)()

  Object.keys(channels).forEach(function(namespace) {
    var channel = channels[namespace]
    var chnAdapter = chnAdapters[namespace]
    pipeline = pipeline
      .pipe(function() {
        return {
          channel: channel,
          chnAdapter: chnAdapter
        }
      }, null, ['channel', 'chnAdapter'])
      .concat(initChannel)
      .pipe(function(chnRepEvents) {
        channel.chnRepEvents = chnRepEvents
      }, 'chnRepEvents')
  })

  pipeline.pipe(next)()
}

exports.setDefaultChannelHandlers = function(channel) {
  if (!channel.auth) {
    debug('Please define `auth` property in channel to set your own auth handler function.')
    channel.auth = function(session, next) {
      next()
    }
  }
  if (!channel.join) {
    debug('Please define `join` property in channel to set your own join handler function.')
    channel.join = function(session, chn, next) {
      next()
    }
  }
  if (!channel.left) {
    debug('Please define `left` property in channel to set your own leave handler function.')
    channel.left = function(session, chn, reason) {}
  }
  if (!channel.allow) {
    debug('Please define `allow` property in channel to set your own allow handler function.')
    channel.allow = function(session, chn, event, next) {
      next()
    }
  }
  if (!channel.error) {
    debug('Please define `error` property in channel to set your own error handler function.')
    channel.error = function(error) {
      debug('Channel error:', error)
    }
  }
}

exports.bindChannelMethods = function(channel, chnAdapter, service) {
  var ctx = {
    pub: chnAdapter.pubChn.bind(chnAdapter),
    service: service
  }
  Object.keys(channel).forEach(function(name) {
    var fn = channel[name]
    if ('function' === typeof fn)
      channel[name] = fn.bind(ctx)
  })
}

exports.attachEventHandlers = function(chnAdapter, channel) {
  var excluded = ['auth', 'join', 'left', 'allow', 'error']
  var repEvents = []
  Object.keys(channel).forEach(function(name) {
    var handler = channel[name]
    if ('function' === typeof handler && -1 === excluded.indexOf(name)) {
      repEvents.push(name)
      chnAdapter.rep(name, handler)
    }
  })
  return {
    chnRepEvents: repEvents
  }
}

function prepareChnPipeline(pack, stream, next) {
  var meta = pack.meta

  var _meta = {
    sid: meta[SID],
    cookie: meta[CKE],
    session: meta[SSN]
  }

  return {
    chn: meta[MCH],
    meta: _meta,
    event: pack.event,
    parentNext: next
  }
}

function requireSession(session, next) {
  if (session)
    next()
}

exports.buildJoinHook = function(channel) {
  var chnJoinHook = Superpipe.pipeline()
    .pipe(prepareChnPipeline, 3, ['chn', 'meta', 'event', 'parentNext'])
    .pipe(channel.auth, ['meta', 'next'], ['session', 'ssn'])
    .pipe(requireSession, ['session', 'next'])
    .pipe(channel.join, ['session', 'chn', 'next'], ['repEvents', 'subEvents'])
    .pipe('parentNext', ['session', 'ssn', {
      REP: 'repEvents',
      SUB: 'subEvents'
    }])
    .error(channel.error)
    .toPipe()
  return {
    chnJoinHook: chnJoinHook
  }
}

exports.buildAllowHook = function(channel) {
  var chnAllowHook = Superpipe.pipeline()
    .pipe(prepareChnPipeline, 3, ['chn', 'meta', 'event', 'parentNext'])
    .pipe(channel.auth, ['meta', 'next'], ['session', 'ssn'])
    .pipe(requireSession, ['session', 'next'])
    .pipe(channel.allow, ['session', 'chn', 'event', 'next'])
    .pipe('parentNext?', 'session')
    .error(channel.error)
    .toPipe()
  return {
    chnAllowHook: chnAllowHook
  }
}

exports.attachAllowHook = function(chnAdapter, channel, chnJoinHook, chnAllowHook) {
  var allowHook = function(pack, stream, dispatch) {
    if (REQ === pack.type) {
      chnAllowHook(pack, stream, function(session) {
        pack.msg.unshift(session)
        dispatch(pack, stream)
      })
    } else if (INF === pack.type) {
      chnJoinHook(pack, stream, function(session, ssn, allowedEvents) {
        if (ACK === pack.event && (ssn || allowedEvents[REP] || allowedEvents[SUB])) {
          var meta = pack.meta
          // session value is set, ack gateway.
          if (ssn)
            meta[SSN] = ssn
          chnAdapter.queue.one([stream], {
            type: type.INF,
            event: type.ACK,
            msg: allowedEvents,
            meta: meta
          })
        } else if (LVE === pack.event && Array.isArray(pack.msg)) {
          channel.left(session, pack.meta[MCH], pack.msg[0])
        }
      })
    }
  }
  chnAdapter.allow(allowHook)
}

exports.startChnBackendServer = function(channels, chnBackend, chnEndpoint, next) {
  var target = Url.parse(chnEndpoint)

  var server = chnBackend.bind(chnEndpoint)
  chnBackend.on('bind', function() {
    var address = server.address()
    var endpoint = target.protocol + '//' + target.hostname + ':' + address.port
    var namespaces = {}
    Object.keys(channels).forEach(function(namespace) {
      namespaces[namespace] = {
        REP: channels[namespace].chnRepEvents
      }
    })
    var chnAnn = {
      endpoint: endpoint,
      namespaces: namespaces
    }
    next(null, 'chnAnn', chnAnn)
  })
}
