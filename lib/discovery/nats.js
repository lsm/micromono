/**
 * NATS backend for service discovery
 */

/**
 * Module dependencies
 */

var nats = require('nats')
var debug = require('debug')('micromono:discovery:nats')


exports.announce = function(data, options, interval) {
  interval = interval || 500

  var ann = JSON.stringify(data)
  var natsClient = connect(options)

  var send = function() {
    natsClient.publish('micromono/service/announcement', ann)
  }

  send()

  setInterval(send, interval)
}

exports.listen = function(options, callback) {
  var natsClient = connect(options)
  natsClient.on('error', function(err) {
    debug(err)
  })

  natsClient.subscribe('micromono/service/announcement', function(data) {
    data = JSON.parse(data)
    callback(null, data)
  })
}

/**
 * Private functions
 */

function connect(options) {
  var servers = options.discoveryNatsServers.split(',')
  debug('nats servers: ', servers)
  return nats.connect({
    'servers': servers
  })
}

