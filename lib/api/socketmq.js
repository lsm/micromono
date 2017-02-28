var logger = require('../logger')('micromono:rpc:socketmq')
var msgpack = require('msgpack-lite')
var socketmq = require('socketmq')

var REQ_NAME = 'micromono/api/rpc'

var SocketMQAdapter = module.exports = function() {}

SocketMQAdapter.prototype.type = 'socketmq'

SocketMQAdapter.prototype.getSocketMQ = function() {
  var smq = this.smq
  if (!smq) {
    smq = socketmq()
    smq.setMsgEncoder(msgpack, Buffer('m'))
    this.smq = smq
  }
  return smq
}

SocketMQAdapter.prototype.send = function(data) {
  logger.trace('Send message', {
    data: data
  })

  var fn
  var args = data.args

  if ('function' === typeof args[args.length - 1]) {
    fn = args.pop()
    data.cid = true
  }

  this.adapter.smq.req(REQ_NAME, data, fn || function() {})
}

SocketMQAdapter.prototype.connect = function(provider) {
  var self = this
  var adapter = this.adapter
  var name = provider.name
  var endpoint = 'tcp://' + provider.host + ':' + provider.api.port

  logger.info('Connecting to API provider', {
    service: provider.name + '@' + provider.version,
    endpoint: endpoint
  })

  var smq = adapter.smq
  if (!smq) {
    // Create socketmq instance if not exists.
    smq = this.adapter.getSocketMQ()
    smq.on('disconnect', function(socket) {
      self.onProviderDisconnect(socket.provider)
      logger.info('API provider disconnected', {
        name: name,
        host: socket.provider.host
      })
    })
    smq.on('error', function(err) {
      var provider = err.stream && err.stream.provider
      logger.warn('API provider error', {
        name: name,
        host: provider ? provider.host : 'unknown host',
        error: err
      })
    })
  }

  var socket = smq.connect(endpoint)
  socket.provider = provider
}

SocketMQAdapter.prototype.startServer = function(port, host, callback) {
  var self = this
  var smq = this.adapter.getSocketMQ()
  var uri = 'tcp://' + host + ':' + port

  logger.info('Start API server', {
    endpoint: uri
  })

  var server = smq.bind(uri)

  smq.on('bind', function() {
    callback(null, server)
  })
  smq.on('connect', function(stream) {
    logger.info('Remote client connected', {
      remoteAddress: stream.remoteAddress
    })
  })
  smq.on('disconnect', function(stream) {
    logger.info('Remote client disconnected', {
      remoteAddress: stream.remoteAddress
    })
  })

  // Response the rpc request.
  smq.rep(REQ_NAME, self.dispatch.bind(self))
}

// SocketMQ has built-in serializer, override.

SocketMQAdapter.prototype.serialize = function(msg) {
  return msg
}

SocketMQAdapter.prototype.deserialize = function(data) {
  return data
}
