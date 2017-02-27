/**
 * NATS backend for service discovery
 */

/**
 * Module dependencies
 */

var nats = require('nats')
var logger = require('../logger')('micromono:discovery:nats')
var assign = require('lodash.assign')
var NATS_DEFAULT_OPTIONS = {
  reconnect: true,
  reconnectTimeWait: 3000,
  waitOnFirstConnect: true,
  maxReconnectAttempts: 60
}


/**
 * Announce service.
 * 
 * @param  {Object} data        Data to announce.
 * @param  {Object} options     Discovery options.
 * @param  {Number} [interval]  Optional interval in milliseconds. 
 */
exports.announce = function(data, options, interval) {
  options = assign({}, NATS_DEFAULT_OPTIONS, options)
  interval = interval || options.MICROMONO_DISCOVERY_ANNOUNCE_INTERVAL || 3000

  logger.info('Announcing service using nats pubsub', {
    service: data.name,
    interval: interval
  }).debug(options).trace(data)

  var ann = JSON.stringify(data)
  var natsClient = connect(options)
  var send = function() {
    natsClient.publish('micromono/service/announcement', ann)
  }

  // Wait for first connect.
  natsClient.once('connect', function() {
    logger.debug('Nats connected, start announcing service.')
    send()
    setInterval(send, interval)
  })

  natsClient.on('error', function(err) {
    logger.fatal('Failed to connect nats', {
      error: err,
      service: data.name
    }).debug(options).trace(data)
    throw err
  })

  natsClient.on('close', function() {
    logger.fatal('All connections to nats have been lost', {
      service: data.name,
      natsServers: options.servers
    }).debug(options).trace(data)
    throw new Error('All connections to nats have been lost.')
  })
}

/**
 * Listen service announcements.
 * 
 * @param  {Object}                         options  Discovery options
 * @param  {Function(Error|null, String|Object)} callback Returns result of 
 * discovery through callback. It returns `null` & `Object` on successful 
 * discovery or `Error` and `String` on failure.
 */
exports.listen = function(options, callback) {
  logger.info('Listening service annoucements using nats pubsub.')
    .debug(options)

  var natsClient = connect(options)

  natsClient.on('error', function(err) {
    logger.fatal('Failed to connect nats', {
      error: err
    }).debug(options)
    throw err
  })

  natsClient.on('close', function() {
    logger.fatal('All connections to nats have been lost', {
      natsServers: options.servers
    }).debug(options)
    throw new Error('All connections to nats have been lost.')
  })

  natsClient.subscribe('micromono/service/announcement', function(data) {
    try {
      data = JSON.parse(data)
      callback(null, data)
    } catch (e) {
      callback(e, data)
    }
  })
}


/**
 * Private for connecting to nats.
 */
function connect(options) {
  var servers = options.MICROMONO_DISCOVERY_NATS_SERVERS.split(',')
  options = assign({}, NATS_DEFAULT_OPTIONS, {
    'servers': servers
  })
  logger.info('Connecting to nats servers', {
    servers: servers
  }).debug(options)
  return nats.connect(options)
}
