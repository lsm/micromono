var debug = require('debug')('micromono:rpc:socketmq')
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
  debug('[%s] connecting to endpoint "%s"', name, endpoint)

  var smq = adapter.smq
  if (!smq) {
    // Create socketmq instance if not exists.
    smq = this.adapter.getSocketMQ()
    smq.on('disconnect', function(socket) {
      self.onProviderDisconnect(socket.provider)
      debug('[%s] provider "%s" closed', socket.provider.name, socket.provider.host)
    })
    smq.on('error', function(err, socket) {
      self.onProviderDisconnect(socket.provider)
      debug('[%s] provider "%s" error', socket.provider.name, socket.provider.host)
    })
  }

  var socket = smq.connect(endpoint)
  socket.provider = provider
}

SocketMQAdapter.prototype.startServer = function(port, host, callback) {
  var self = this
  var smq = this.adapter.getSocketMQ()
  var uri = 'tcp://' + host + ':' + port

  var server = smq.bind(uri)

  smq.on('bind', function() {
    callback(null, server)
  })
  smq.on('connect', function(sock) {
    debug('client connected from %s', sock.remoteAddress)
  })

  var dispatch = self.dispatch.bind(self)
  // Response the rpc request.
  smq.rep(REQ_NAME, dispatch)
}

// SocketMQ has built-in serializer, override.

SocketMQAdapter.prototype.serialize = function(msg) {
  return msg
}

SocketMQAdapter.prototype.deserialize = function(data) {
  return data
}
