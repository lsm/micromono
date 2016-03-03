var path = require('path')
var util = require('util')
var debug = require('debug')('micromono:discovery')
var Router = require('../web/router')
var spawnSync = require('child_process').spawnSync
var RemotePipe = require('../service/remote')


exports.require = function(serviceName, serviceDir) {
  var service
  var servicePath = serviceName
  serviceDir = serviceDir || this.serviceDir

  var ServiceClass = exports.localRequire(serviceName, serviceDir, this.services)

  if (false === ServiceClass) {
    debug('[%s] Failed to locate service locally, try to discover from network.', serviceName)

    ServiceClass = exports.remoteRequire(serviceName)
  }

  if ('function' === typeof ServiceClass)
    service = new ServiceClass()
  else
    service = ServiceClass

  service.name = serviceName
  if (servicePath)
    service.packagePath = servicePath
  this.register(service, serviceName)

  return service
}

exports.localRequire = function(serviceName, serviceDir, services) {
  var ServiceClass
  var servicePath = serviceName

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
    if ('MODULE_NOT_FOUND' !== e.code || expectedMessage !== e.message)
      // throw error if we found the module which contains error.
      throw e
    else
      return false
  }

  return ServiceClass
}

exports.remoteRequire = function(serviceName) {
  var ServiceClass
  var args = [require.resolve('./prober'), serviceName]
  args = args.concat(process.argv.slice(2))
  var probedResult = spawnSync('node', args, {
    stdio: [process.stdin, 'pipe', process.stderr]
  })

  if (0 !== probedResult.status) {
    throw new Error(probedResult.stderr && probedResult.stderr.toString())
  } else {
    var announcement = JSON.parse(probedResult.stdout)
    var ann = util.inspect(announcement, {
      colors: true,
      depth: 4
    })
    debug('[%s] service probed from network:', announcement.name, '\n', ann)
    ServiceClass = RemotePipe.buildServiceFromAnnouncement(announcement)
    if (ServiceClass.middleware)
      Router.rebuildRemoteMiddlewares(ServiceClass.middleware, ServiceClass)
  }

  return ServiceClass
}

exports.register = function(serviceInstance, name) {
  debug('[%s] register service', name)
  this.services[name] = serviceInstance
  return serviceInstance
}
