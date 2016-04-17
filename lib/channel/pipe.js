var Url = require('url')
var type = require('socketmq/lib/message/type')
var debug = require('debug')('micromono:channel:pipe')
var socketmq = require('socketmq')
var superpipe = require('superpipe')


var INF = type.INF
var REQ = type.REQ
var REP = type.REP
var MCH = type.MCH
var CKE = type.CKE
var SSN = type.SSN


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
  service.pub = smqChannel.pubChn.bind(smqChannel)
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
  return {
    chn: meta[MCH],
    cookie: meta[CKE],
    event: pack.event,
    session: meta[SSN],
    parentNext: next
  }
}

function requireSession(session, next) {
  if (session)
    next()
}

exports.buildJoinHook = function(channel) {
  var chnJoinHook = superpipe()
    .pipe(prepareChnPipeline, 3, ['chn', 'cookie', 'event', 'session', 'parentNext'])
    .pipe(channel.auth, ['cookie', 'session', 'next'], ['session', 'ssn'])
    .pipe(requireSession, ['session', 'next'])
    .pipe(channel.join, ['session', 'chn', 'next'], 'repEvents')
    .pipe('parentNext', ['ssn', 'repEvents'])
    .error(channel.error)
    .toPipe()
  return {
    chnJoinHook: chnJoinHook
  }
}

exports.buildAllowHook = function(channel) {
  var chnAllowHook = superpipe()
    .pipe(prepareChnPipeline, 3, ['chn', 'cookie', 'event', 'session', 'parentNext'])
    .pipe(channel.auth, ['cookie', 'session', 'next'], ['session', 'ssn'])
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
      chnJoinHook(pack, stream, function(ssn, repEvents) {
        if (ssn || repEvents) {
          var meta = pack.meta
          // session value is set, ack gateway.
          if (ssn)
            meta[SSN] = ssn
          var msg = {}
          if (Array.isArray(repEvents) && repEvents.length > 0)
            msg[REP] = repEvents
          chnAdapter.queue.one([stream], {
            type: type.INF,
            event: type.ACK,
            msg: msg,
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
