var debug = require('debug')('micromono:discovery:pipe')
var config = require('../config')


exports.prepareDiscovery = function(discoveryOptions) {
  if (!discoveryOptions)
    discoveryOptions = config(['default', 'discovery'])

  var discovery = require('./' + discoveryOptions.MICROMONO_DISCOVERY_BACKEND)

  return {
    discoveryListen: discovery.listen,
    discoveryAnnounce: discovery.announce,
    discoveryOptions: discoveryOptions
  }
}

exports.listenProviders = function(services, discoveryListen, discoveryOptions, addProvider) {
  var remoteServices = Object.keys(services).filter(function(serviceName) {
    return true === services[serviceName].isRemote
  })

  if (0 < remoteServices.length) {
    debug('start listening providers for following remote services:\n', remoteServices)
    discoveryListen(discoveryOptions, function(err, ann) {
      if (err)
        debug('Service discovery error: ', err && err.stack || err, ann)
      else if (ann && -1 < remoteServices.indexOf(ann.name))
        addProvider(services[ann.name].scheduler, ann)
    })
  }
}

exports.getDiscoveryOptions = function(micromono) {
  var keys = [
    'MICROMONO_DISCOVERY_BACKEND',
    'MICROMONO_DISCOVERY_TIMEOUT',
    'MICROMONO_DISCOVERY_ANNOUNCE_INTERVAL',
    'MICROMONO_DISCOVERY_AGENT_PATH',
    'MICROMONO_DISCOVERY_UDP_MULTICAST',
    'MICROMONO_DISCOVERY_UDP_PORT',
    'MICROMONO_DISCOVERY_NATS_SERVERS'
  ]
  var options = {}

  keys.forEach(function(key) {
    var value = micromono.get(key)
    if (value)
      options[key] = value
  })

  return options
}
