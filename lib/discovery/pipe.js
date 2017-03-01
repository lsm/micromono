var logger = require('../logger')('micromono:discovery:pipe')
var config = require('../config')


exports.prepareDiscovery = function(discoveryOptions) {
  if (!discoveryOptions)
    discoveryOptions = config(['default', 'discovery'])

  var options = {}
  Object.keys(discoveryOptions).forEach(function(key) {
    if (/^MICROMONO_DISCOVERY/.test(key))
      options[key] = discoveryOptions[key]
  })

  var discovery = require('./' + options.MICROMONO_DISCOVERY_BACKEND)

  return {
    discoveryListen: discovery.listen,
    discoveryAnnounce: discovery.announce,
    discoveryOptions: options
  }
}

exports.listenProviders = function(services, discoveryListen, discoveryOptions, addProvider) {
  var remoteServices = Object.keys(services).filter(function(serviceName) {
    return true === services[serviceName].isRemote
  })

  if (0 < remoteServices.length) {
    logger.info('start listening remote service providers', {
      remoteServices: remoteServices
    })
    discoveryListen(discoveryOptions, function(err, ann) {
      if (err) {
        logger.error('Service discovery error', {
          error: err && err.stack || err,
          provider: ann
        })
      } else if (ann && -1 < remoteServices.indexOf(ann.name)) {
        addProvider(services[ann.name].scheduler, ann)
      }
    })
  }
}
