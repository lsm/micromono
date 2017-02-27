/**
 * Serivce discovery script. Used as proxy for probing network services
 * synchronously upon service startup. E.g. micromono.require('some-service')
 */

/**
 * Module dependencies
 */
var logger = require('../logger')('micromono:discovery:prober')
var prepareDiscovery = require('./pipe').prepareDiscovery

// Get service name and discovery options
var discovery = prepareDiscovery()
var options = discovery.discoveryOptions
var backend = options.MICROMONO_DISCOVERY_BACKEND
var timeout = options.MICROMONO_DISCOVERY_TIMEOUT || 90000
var serviceName = options.MICROMONO_DISCOVERY_TARGET

info()

var Discovery = require('./' + backend)

setInterval(info, 5000)

Discovery.listen(options, function(err, data) {
  if (err) {
    logger.error('Discovering error', {
      data: data,
      error: err,
      service: serviceName
    }).debug(options).trace(discovery)
    return
  }
  if (data && serviceName === data.name) {
    timer && clearTimeout(timer)
    process.stdout.write(JSON.stringify(data), function() {
      process.exit(0)
    })
  }
})

var timer = setTimeout(function() {
  process.stdout.write('Probing service [' + serviceName + '] timeout after ' + timeout / 1000 + ' seconds', function() {
    process.exit(1)
  })
}, timeout)

process.on('SIGINT', function() {
  timer && clearTimeout(timer)
  logger.info('Stop probing service', {
    backend: backend,
    service: serviceName
  }).debug(options).trace(discovery)
  process.exit(255)
})

function info() {
  logger.info('Discovering service', {
    backend: backend,
    service: serviceName
  }).debug(options).trace(discovery)
}
