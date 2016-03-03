var debug = require('debug')('micromono:discovery:pipe')


exports.prepareDiscovery = function() {
  var discoveryOptions = require('../args/discovery').parse(process.argv)
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
