var debug = require('debug')('micromono:discovery:pipe')
var config = require('../config')


exports.prepareDiscovery = function() {
  var discoveryOptions = config(['default', 'discovery'])
  var discovery = require('./' + discoveryOptions.discoveryBackend)

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
      if (err) {
        debug('service discovery error: ', err && err.stack || err, ann)
      } else if (ann && -1 < remoteServices.indexOf(ann.name)) {
        addProvider(services[ann.name].scheduler, ann)
      }
    })
  }
}
