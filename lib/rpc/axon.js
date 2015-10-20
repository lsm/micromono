var axon = require('axon')
var debug = require('debug')('micromono:rpc')


var AxonAdapter = module.exports = {}

AxonAdapter.type = 'axon'

AxonAdapter.send = function(data) {
  var provider = this.scheduler.get()
  var socket = provider.socket
  var args = data.args
  var fn

  if ('function' === typeof args[args.length - 1]) {
    fn = args.pop()
    data.cid = true
  }

  var msg = this.serialize(data)
  socket.send(msg, fn || function() {})
}

AxonAdapter.connect = function(provider) {
  var endpoint = 'tcp://' + provider.address + ':' + provider.rpcPort
  var socket = axon.socket('req')

  var self = this
  socket.on('disconnect', function() {
    debug('axon provider %s disconnected', endpoint)
    self.onProviderDisconnect(provider)
  })

  provider.socket = socket
}

AxonAdapter.startServer = function(port, host) {
  var self = this
  var socket = axon.socket('rep')

  var promise = new Promise(function(resolve, reject) {
    socket.bind(port, host, function() {
      resolve(socket.server)
    })

    socket.on('message', function(msg, callback) {
      self.dispatch(msg, callback)
    })
  })

  return promise
}
