/**
 * UDP multicast backend for service discovery
 */

/**
 * Module dependencies
 */

var dgram = require('dgram')
var debug = require('debug')('micromono:discovery:udp')


exports.announce = function(data, options, interval) {
  interval = interval || 500

  var buf = JSON.stringify(data)
  var len = Buffer.byteLength(buf)
  var port = Number(options.discoveryUdpPort)
  var address = options.discoveryUdpMulticast
  var socket = dgram.createSocket('udp4')

  var send = function() {
    socket.send(buf, 0, len, port, address)
  }

  send()

  setInterval(send, interval)
}

exports.listen = function(options, callback) {
  var socket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true
  })

  socket.bind(options.discoveryUdpPort, function() {
    socket.addMembership(options.discoveryUdpMulticast)
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
