/**
 * UDP multicast backend for service discovery
 */

/**
 * Module dependencies
 */

var dgram = require('dgram')
var logger = require('../logger')('micromono:discovery:udp')
var ERR_PORT_INUSE = 'UDP port in use, please make sure you don\'t have other instances of micromono running as consumer with the same network settings.'

// Defaults
var PORT = 11628
var ADDRESS = '224.0.0.116'


exports.announce = function(data, options, interval) {
  interval = interval || options.MICROMONO_DISCOVERY_ANNOUNCE_INTERVAL || 3000
  var port = Number(options.MICROMONO_DISCOVERY_UDP_PORT || PORT)
  var address = options.MICROMONO_DISCOVERY_UDP_ADDRESS || ADDRESS

  logger.info('Announcing service using udp multicast', {
    port: port,
    address: address,
    service: data.name,
    interval: interval
  }).debug(options).trace(data)

  var buf = JSON.stringify(data)
  var len = Buffer.byteLength(buf)
  var socket = dgram.createSocket('udp4')
  var send = function() {
    socket.send(buf, 0, len, port, address)
  }

  // Start announcing 
  send()
  setInterval(send, interval)
}

exports.listen = function(options, callback) {
  var port = options.MICROMONO_DISCOVERY_UDP_PORT || PORT
  var address = options.MICROMONO_DISCOVERY_UDP_ADDRESS || ADDRESS

  logger.info('Listening service annoucements using udp multicast', {
    port: port,
    address: address
  }).debug(options)

  var socket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true
  })

  socket.bind(port, function() {
    socket.addMembership(address)
  })

  socket.on('error', function(err) {
    if (err) {
      logger.fatal('EADDRINUSE' === err.errno ? ERR_PORT_INUSE : 'UDP socket error', {
        port: port,
        address: address
      })
    }
    callback(err)
  })

  socket.on('message', function(data, rinfo) {
    try {
      data = JSON.parse(data)
      if (!data.host)
        data.host = rinfo.address
      callback(null, data, rinfo)
    } catch (e) {
      callback(e, data)
    }
  })
}
