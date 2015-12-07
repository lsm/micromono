/**
 * Serivce discovery script. Used as proxy for probing network services upon
 * composer startup. E.g. micromono.require('some-service')
 */

/**
 * Module dependencies
 */
var Discovery = require('./udp')
var debug = require('debug')('micromono:discovery')

function found(data, exitCode) {
  if (exitCode === 0) {
    process.stdout.write(JSON.stringify(data), function() {
      process.exit(0)
    })
  } else {
    process.stderr.write(data, function() {
      process.exit(exitCode)
    })
  }
}

var serviceName = process.argv[2]
var timer = setInterval(function() {
  debug('[%s] Trying to discover service from udp network.', serviceName)
}, 2000)

Discovery.listen(function(err, data, rInfo) {
  if (data && data.name === serviceName) {
    clearTimeout(timer)
    found(data, 0)
  }
})
