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
var serviceName = process.argv[2]
var discovery = prepareDiscovery()
var options = discovery.discoveryOptions
var backend = options.discoveryBackend

debug('[%s] Discovering service using backend [%s]', serviceName, backend)

var Discovery = require('./' + backend)

setInterval(function() {
  debug('[%s] Discovering service using backend [%s]', serviceName, backend)
}, 2000)

Discovery.listen(options, function(err, data) {
  if (data && serviceName === data.name) {
    process.stdout.write(JSON.stringify(data), function() {
      process.exit(0)
    })
  }
})

process.on('SIGINT', function() {
  debug('[%s] Stopping micromono prober...', serviceName)
  process.exit(255)
})
