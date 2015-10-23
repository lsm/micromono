var axon = require('axon')
var debug = require('debug')('micromono:rpc:axon')


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
  var name = provider.name
  var endpoint = 'tcp://' + provider.address + ':' + provider.rpcPort
  debug('[%s] connect to endpoint "%s"', name, endpoint)

  var socket = axon.socket('req')

  var self = this
  socket.on('close', function() {
    debug('[%s] provider %s closed', name, endpoint)
    self.onProviderDisconnect(provider)
  })

  socket.connect(endpoint, function() {
    debug('[%s] connected to endpoint "%s"', name, endpoint)
    // heartbeat
    var hid
    var lastPong = Date.now()

    function heartbeat() {
      var now = Date.now()
      if (now - lastPong > 3000) {
        debug('[%s] heartbeat timeout, close socket', name)
        // timeout, disconnect socket
        clearInterval(hid)
        socket.close()
      } else {
        socket.send('ping', function(msg) {
          lastPong = Date.now()
        // debug('[%s] client got ' + msg, name)
        })
      }
    }

    heartbeat()
    hid = setInterval(heartbeat, 1000)
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
      if (msg === 'ping') {
        callback('pong')
      // debug('server got ping')
      } else {
        self.dispatch(msg, callback)
      }
    })
  })

  return promise
}
