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
  var self = this
  var name = provider.name
  var endpoint = 'tcp://' + provider.host + ':' + provider.rpc.port
  debug('[%s] connecting to endpoint "%s"', name, endpoint)

  var socket = axon.socket('req')
  var closing = false

  function closeSocket() {
    if (!closing) {
      closing = true
      socket.close()
      self.onProviderDisconnect(provider)
      debug('[%s] provider "%s" closed', name, endpoint)
    }
  }

  socket.on('close', function() {
    debug('[%s] socket on close, provider "%s"', name, endpoint)
    closeSocket()
  })

  socket.on('socket error', function(err) {
    debug('[%s] socket on error [%s], provider "%s"', name, err.code, endpoint)
    closeSocket()
  })

  socket.on('connect', function(sock) {
    var closeListeners = sock.listeners('close')
    sock.removeAllListeners('close')

    closeListeners.unshift(function() {
      debug('[%s] sock on close, provider "%s"', name, endpoint)
      closeSocket()
    })

    closeListeners.forEach(function(listener) {
      sock.on('close', listener)
    })
  })

  socket.connect(endpoint, function() {
    debug('[%s] connected to endpoint "%s"', name, endpoint)

    // heartbeat
    var hid
    var lastPong = Date.now()

    function heartbeat() {
      var now = Date.now()
      if (now - lastPong > 3000) {
        // timeout, disconnect socket
        debug('[%s] heartbeat timeout, close socket provider "%s"', name, endpoint)
        clearInterval(hid)
        closeSocket()
      } else {
        socket.send('ping', function(msg) {
          // debug('[%s] client got ' + msg, name)
          if (msg === 'pong') {
            lastPong = Date.now()
          }
        })
      }
    }

    debug('[%s] start heartbeating', name)
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
        // debug('server got ping')
        callback('pong')
      } else {
        self.dispatch(msg, callback)
      }
    })

    socket.on('connect', function(sock) {
      debug('client connected from', sock._peername)
    })
  })

  return promise
}
