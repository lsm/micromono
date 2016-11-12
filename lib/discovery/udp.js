/**
 * UDP multicast backend for service discovery
 */

/**
 * Module dependencies
 */

var dgram = require('dgram')
var debug = require('debug')('micromono:discovery:udp')

// Defaults
var MULTICAST = '224.0.0.116'
var PORT = 11628


exports.announce = function(data, options, interval) {
  interval = interval || options.discoveryAnnounceInterval

  var buf = JSON.stringify(data)
  var len = Buffer.byteLength(buf)
  var port = Number(options.discoveryUdpPort || PORT)
  var address = options.discoveryUdpMulticast || MULTICAST
  var socket = dgram.createSocket('udp4')

  var send = function() {
    socket.send(buf, 0, len, port, address)
  }

  debug('Announcing service [%s] using udp multicast: %s:%s', data.name, address, port)

  send()

  setInterval(send, interval)
}

exports.listen = function(options, callback) {
  var socket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true
  })

  var port = options.discoveryUdpPort || PORT
  var address = options.discoveryUdpMulticast || MULTICAST

  debug('Listening service annoucements using udp multicast: %s:%s', address, port)

  socket.bind(port, function() {
    socket.addMembership(address)
  })

  socket.on('error', function(err) {
    if (err && 'EADDRINUSE' === err.errno)
      debug('UDP port in use, please make sure you don\'t have other instances of micromono running as consumer with the same network settings.')
    callback(err)
  })

  socket.on('message', function(data, rinfo) {
    data = JSON.parse(data)
    if (!data.host)
      data.host = rinfo.address
    callback(null, data, rinfo)
  })
}
