var Url = require('url')
var type = require('socketmq/lib/message/type')
var debug = require('debug')('micromono:channel:pipe')
var socketmq = require('socketmq')
var superpipe = require('superpipe')


var INF = type.INF
var REQ = type.REQ
var REP = type.REP
var SUB = type.SUB
var MCH = type.MCH
var CKE = type.CKE
var SSN = type.SSN
var SID = type.SID


var reservedNames = ['pub', 'pubChn', 'sub', 'req', 'reqChn', 'rep']
exports.checkChannelPropertyName = function(channel, service) {
  function check(obj) {
    Object.keys(obj).forEach(function(name) {
      if (reservedNames.indexOf(name) > -1) {
        var e = new Error('Property name "' + name + '" is reserved for channel.')
        debug(e.stack)
        process.exit(-1)
      }
    })
  }
  check(channel)
  check(service)
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

exports.bindChannelMethods = function(channel, service) {
  Object.keys(channel).forEach(function(name) {
    var fn = channel[name]
    if ('function' === typeof fn)
      channel[name] = fn.bind(service)
  })
}

exports.createChannelAdapter = function(channel, service) {
  var smqChannel = socketmq.channel(channel.namespace)
  service.pubChn = smqChannel.pubChn.bind(smqChannel)
  return {
    chnAdapter: smqChannel,
    chnNamespace: channel.namespace
  }
}

exports.attachEventHandlers = function(chnAdapter, channel) {
  var excluded = ['auth', 'join', 'allow', 'error']
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
  var chnJoinHook = superpipe()
    .pipe(prepareChnPipeline, 3, ['chn', 'meta', 'event', 'parentNext'])
    .pipe(channel.auth, ['meta', 'next'], ['session', 'ssn'])
    .pipe(requireSession, ['session', 'next'])
    .pipe(channel.join, ['session', 'chn', 'next'], ['repEvents', 'subEvents'])
    .pipe('parentNext', ['ssn', {
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
  var chnAllowHook = superpipe()
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
      chnJoinHook(pack, stream, function(ssn, allowedEvents) {
        if (ssn || allowedEvents[REP] || allowedEvents[SUB]) {
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
        }
      })
    }
  }
  chnAdapter.allow(allowHook)
}

exports.startChannelServer = function(chnAdapter, chnEndpoint, next) {
  var target = Url.parse(chnEndpoint)
  var server = chnAdapter.bind(chnEndpoint)
  chnAdapter.on('bind', function() {
    if (!target.port) {
      var address = server.address()
      chnEndpoint = target.protocol + '//' + target.hostname + ':' + address.port
    }
    next(null, 'chnEndpoint', chnEndpoint)
  })
}

// Balancer functions

exports.ensureChannelGateway = function(chnGateway, set) {
  if (!chnGateway) {
    debug('Create new channel gateway instance')
    chnGateway = socketmq.gateway()
    chnGateway.isUntrusted = function(stream) {
      return 'eio' === stream.__smq__.protocol
    }
    chnGateway.on('disconnect', function(stream) {
      if (stream.provider && stream.scheduler) {
        var provider = stream.provider
        debug('Channel provider of [%s] disconnected %s %s',
          provider.name + '@' + provider.version,
          provider.host,
          provider.id.slice(0, 8))
        stream.scheduler.remove(provider)
      }
    })
    set('chnGateway', chnGateway)
  }
  return true
}

var connectToChannel = exports.connectToChannel = function(channel, chnGateway, announcement, scheduler, next) {
  chnGateway.connect(channel.endpoint, function(stream) {
    debug('[%s] channel endpoint %s connected',
      announcement.name, channel.endpoint)
    stream.provider = announcement
    stream.scheduler = scheduler
    next && next()
  })
}

exports.channelOnNewProvider = function(chnGateway, scheduler) {
  scheduler.on('add', function(provider) {
    if (provider.channel) {
      debug('New channel provider of [%s] found %s %s',
        provider.name + '@' + provider.version,
        provider.host,
        provider.id.slice(0, 8))
      connectToChannel(provider.channel, chnGateway, provider, scheduler)
    }
  })
}

exports.attachChnGatewayServer = function(chnGateway, httpServer) {
  chnGateway.bind('eio://', {
    httpServer: httpServer
  })
}
