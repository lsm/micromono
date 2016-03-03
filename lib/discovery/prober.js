/**
 * Serivce discovery script. Used as proxy for probing network services upon
 * service startup. E.g. micromono.require('some-service')
 */

/**
 * Module dependencies
 */
var args = require('../args/discovery')
var debug = require('debug')('micromono:discovery:prober')

// Get service name
var serviceName = process.argv[2]
debug('[%s] discovering service using "%s" backend', serviceName, args.discoveryBackend)
var Discovery = require('./' + args.discoveryBackend)


function found(data, exitCode) {
  if (0 === exitCode)
    process.stdout.write(JSON.stringify(data), function() {
      process.exit(0)
    })
  else
    process.stderr.write(data, function() {
      process.exit(exitCode)
    })
}

var timer = setInterval(function() {
  debug('[%s] Trying to discover service from udp network.', serviceName)
}, 2000)

Discovery.listen(args, function(err, data, rInfo) {
  if (data && serviceName === data.name) {
    clearTimeout(timer)
    found(data, 0)
  }
})
