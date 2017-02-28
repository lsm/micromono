var Url = require('url')
var type = require('socketmq/lib/message/type')
var logger = require('../logger')('micromono:channel:backend')
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
  logger.debug('normalizeChannels')

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

  logger.trace(chn)

  return {
    channels: chn
  }
}

exports.checkChannelPropertyName = function(channels, service) {
  logger.debug('checkChannelPropertyName', {
    service: service.name
  }).trace(channels)

  function check(obj) {
    Object.keys(obj).forEach(function(name) {
      if (reservedNames.indexOf(name) > -1) {
        var e = new Error('Event name "' + name + '" is reserved for channel.')
        logger.fatal(e.stack)
        process.exit(1)
      }
    })
  }
  Object.keys(channels).forEach(function(namespace) {
    check(channels[namespace])
  })
  check(service)
}

exports.createChannelAdapters = function(channels, service) {
  logger.debug('createChannelAdapters', {
    service: service.name
  }).trace(channels)

  var chnBackend = socketmq()
  var chnAdapters = {}

  Object.keys(channels).forEach(function(namespace) {
    chnAdapters[namespace] = chnBackend.channel(namespace)
  })

  // Add channel methods and chnBackend to service instance
  service.getChannel = function(namespace) {
    var chn = chnAdapters[namespace]
    if (!chn) {
      logger.fatal('Service channel has no such namespace', {
        service: service.name,
        namespace: namespace
      })
      process.exit(1)
    }
    return chn
  }

  service.pub = function(namespace) {
    var args = toArray(arguments)
    var adapter = this.getChannel(namespace)
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
  var namespaces = Object.keys(channels)

  logger.debug('setupChannels', {
    service: service.name,
    namespaces: namespaces
  }).trace(channels)

  var pipeline = Superpipe()
    .set(exports)
    .set('service', service)()

  namespaces.forEach(function(namespace) {
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
    logger.warn('Please define `auth` property in channel to set your own auth handler function. All requests will be allowed by default.')
    channel.auth = function(session, next) {
      next()
    }
  }
  if (!channel.join) {
    logger.warn('Please define `join` property in channel to set your own join handler function. All requests will be allowed by default.')
    channel.join = function(session, chn, next) {
      next()
    }
  }
  if (!channel.left) {
    logger.debug('Please define `left` property in channel to set your own leave handler function.')
    channel.left = function(session, chn, reason) {}
  }
  if (!channel.allow) {
    logger.debug('Please define `allow` property in channel to set your own allow handler function. All requests will be allowed by default.')
    channel.allow = function(session, chn, event, next) {
      next()
    }
  }
  if (!channel.error) {
    logger.debug('Please define `error` property in channel to set your own error handler function.')
    channel.error = function(error) {
      logger.error('Channel error', {
        error: error
      })
    }
  }
}

exports.bindChannelMethods = function(channel, chnAdapter, service) {
  Object.keys(channel).forEach(function(name) {
    var fn = channel[name]
    if ('function' === typeof fn)
      channel[name] = fn.bind(service)
  })
}

exports.attachEventHandlers = function(chnAdapter, channel) {
  logger.debug('attachEventHandlers').trace(channel)

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
  logger.debug('buildJoinHook').trace(channel)

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
  logger.debug('buildAllowHook').trace(channel)

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

exports.attachChannelHooks = function(chnAdapter, channel, chnJoinHook, chnAllowHook) {
  logger.debug('attachChannelHooks').trace(channel)

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
  logger.debug('startChnBackendServer').trace({
    chnEndpoint: chnEndpoint,
    channels
  })

  var target = Url.parse(chnEndpoint)
  var server = chnBackend.bind(chnEndpoint)
  chnBackend.on('bind', function() {
    var address = server.address()
    var endpoint = target.protocol + '//' + target.hostname + ':' + address.port

    logger.info('Channel backend bound')

    var namespaces = {}
    Object.keys(channels).forEach(function(namespace) {
      namespaces[namespace] = {
        REP: channels[namespace].chnRepEvents
      }
    })

    logger.debug({
      address: address,
      endpoint: endpoint,
      namespaces: namespaces
    })

    next(null, 'chnAnn', {
      endpoint: endpoint,
      namespaces: namespaces
    })
  })
}
