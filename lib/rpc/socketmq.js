var debug = require('debug')('micromono:rpc:socketmq')
var toArray = require('lodash.toarray')
var socketmq = require('socketmq')

var SocketMQAdapter = module.exports = function() {}

SocketMQAdapter.prototype.type = 'socketmq'

SocketMQAdapter.prototype.send = function(data) {
  var fn
  var args = data.args

  if ('function' === typeof args[args.length - 1]) {
    var _fn = args.pop()
    fn = function(repArgs) {
      _fn.apply(null, repArgs)
    }
    data.cid = true
  }

  this.adapter.smq.req('rpc', data, fn || function() {})
}

SocketMQAdapter.prototype.connect = function(provider) {
  var self = this
  var adapter = this.adapter
  var name = provider.name
  var endpoint = 'tcp://' + provider.host + ':' + provider.rpc.port
  debug('[%s] connecting to endpoint "%s"', name, endpoint)

  var smq = adapter.smq
  if (!smq) {
    // Create socketmq instance if not exists.
    smq = socketmq()
    smq.on('disconnect', function(socket) {
      self.onProviderDisconnect(socket.provider)
      debug('[%s] provider "%s" closed', socket.provider.name, socket.provider.host)
    })
    smq.on('error', function(err, socket) {
      self.onProviderDisconnect(socket.provider)
      debug('[%s] provider "%s" error', socket.provider.name, socket.provider.host)
    })
    adapter.smq = smq
  }

  var socket = smq.connect(endpoint)
  socket.provider = provider
}

SocketMQAdapter.prototype.startServer = function(port, host, callback) {
  var self = this
  var smq = socketmq()
  var uri = 'tcp://' + host + ':' + port

  var server = smq.bind(uri)

  smq.on('bind', function() {
    callback(null, server)
  })
  smq.on('connect', function(sock) {
    debug('client connected from', sock._peername)
  })

  // Response the rpc request.
  smq.rep('rpc', function(msg, cb) {
    self.dispatch(msg, function() {
      // Convert to array since socketmq only accepts one argument.
      var repArgs = toArray(arguments)
      cb(repArgs)
    })
  })
}

// SocketMQ has built-in serializer, override.

SocketMQAdapter.prototype.serialize = function(msg) {
  return msg
}

SocketMQAdapter.prototype.deserialize = function(data) {
  return data
}
