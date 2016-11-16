/**
 * Serivce discovery script. Used as proxy for probing network services
 * synchronously upon service startup. E.g. micromono.require('some-service')
 */

/**
 * Module dependencies
 */

var debug = require('debug')('micromono:discovery:prober')
var prepareDiscovery = require('./pipe').prepareDiscovery

// Get service name and discovery options
var discovery = prepareDiscovery()
var options = discovery.discoveryOptions
var backend = options.MICROMONO_DISCOVERY_BACKEND
var timeout = options.MICROMONO_DISCOVERY_TIMEOUT || 90000
var serviceName = options.MICROMONO_DISCOVERY_TARGET

debug('Discovering service [%s] using backend "%s"', serviceName, backend)

var Discovery = require('./' + backend)

setInterval(function() {
  debug('Discovering service [%s] using backend "%s"', serviceName, backend)
}, 5000)

Discovery.listen(options, function(err, data) {
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
  debug('Stop probing service [%s] ...', serviceName)
  process.exit(255)
})
