var path = require('path')
var util = require('util')
var debug = require('debug')('micromono:discovery:require')
var Router = require('../web/router')
var spawnSync = require('child_process').spawnSync
var RemotePipe = require('../service/remote')


exports.require = function(serviceName, serviceDir) {
  var service
  var servicePath = serviceName
  var ServiceClass
  var services = this.services
  serviceDir = serviceDir || this.serviceDir

  try {
    if (serviceDir) {
      servicePath = path.resolve(serviceDir, serviceName)
      debug('[%s] resolved path "%s"', serviceName, servicePath)
    }
    if (services[serviceName]) {
      debug('[%s] service already required', serviceName)
      return services[serviceName]
    } else {
      debug('[%s] require service from path "%s"', serviceName, servicePath)
      ServiceClass = require(servicePath)
    }
  } catch (e) {
    var expectedMessage = 'Cannot find module \'' + serviceName + '\''
    if (e.code !== 'MODULE_NOT_FOUND' || e.message !== expectedMessage) {
      // throw error if we found the module which contains error.
      throw e
    }

    debug('[%s] Failed to locate service locally, try to probe from network.', serviceName)

    var probedResult = spawnSync('node', [require.resolve('./prober'), serviceName], {
      stdio: [process.stdin, 'pipe', process.stderr]
    })

    if (probedResult.status !== 0) {
      throw new Error(probedResult.stderr.toString())
    } else {
      var announcement = JSON.parse(probedResult.stdout)
      var ann = util.inspect(announcement, {
        colors: true,
        depth: 4
      })
      debug('[%s] service probed from network:', announcement.name, '\n', ann)
      ServiceClass = RemotePipe.buildServiceFromAnnouncement(announcement)
      if (ServiceClass.middleware) {
        Router.rebuildRemoteMiddlewares(ServiceClass.middleware, ServiceClass)
      }
    }
  }

  if ('function' === typeof ServiceClass) {
    service = new ServiceClass()
  } else {
    service = ServiceClass
  }

  service.name = serviceName
  if (servicePath) {
    service.packagePath = servicePath
  }
  this.register(service, serviceName)

  return service
}

exports.listenProviders = function(services, listen, addProvider) {
  var remoteServices = Object.keys(services).filter(function(serviceName) {
    return true === services[serviceName].isRemote
  })

  if (remoteServices.length > 0) {
    debug('start listening providers for following remote services:\n', remoteServices)
    listen(function(err, ann) {
      if (err) {
        debug('service discovery error: ', err && err.stack || err, ann)
      } else if (ann && remoteServices.indexOf(ann.name) > -1) {
        addProvider(services[ann.name].scheduler, ann)
      }
    })
  }
}

exports.register = function(serviceInstance, name) {
  debug('[%s] register service', name)
  this.services[name] = serviceInstance
  return serviceInstance
}
