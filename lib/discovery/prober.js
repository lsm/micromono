/**
 * Serivce discovery script. Used as proxy for probing network services upon
 * service startup. E.g. micromono.require('some-service')
 */

/**
 * Module dependencies
 */
var discoveryArgs = require('../args/discovery').parse(process.argv)
var debug = require('debug')('micromono:discovery:prober')

// console.error(process.env);

// Get service name
var serviceName = process.argv[2]
debug('[%s] discovering service using "%s" backend',
  serviceName, discoveryArgs.discoveryBackend)
var Discovery = require('./' + discoveryArgs.discoveryBackend)


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
  debug('[%s] Trying to discover service from "%s" backend.',
    serviceName, discoveryArgs.discoveryBackend)
}, 2000)

Discovery.listen(discoveryArgs, function(err, data, rInfo) {
  if (data && serviceName === data.name) {
    clearTimeout(timer)
    found(data, 0)
  }
})
