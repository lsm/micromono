var fs = require('fs')
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
    ServiceClass = exports.remoteRequire(serviceName, serviceDir)
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
    var expectedMessage = new RegExp('Cannot find module \'' + servicePath + '\'')
    if ('MODULE_NOT_FOUND' !== e.code || !expectedMessage.test(e.message))
      // throw error if we found the module which contains error.
      throw e
    else
      return false
  }

  return ServiceClass
}

exports.remoteRequire = function(serviceName, serviceDir) {
  var ServiceClass
  var proberPath = require.resolve('./prober')

  if (serviceDir && 928 !== fs.readFileSync(proberPath).length)
    proberPath = path.join(serviceDir, 'node_modules/micromono/lib/discovery/prober.js')

  var args = [proberPath, serviceName]
  args = args.concat(process.argv.slice(2))

  debug('[%s] prober arguments', serviceName, args)

  var probedResult = spawnSync('node', args, {
    stdio: [process.stdin, 'pipe', 'pipe']
  })

  if (0 !== probedResult.status) {
    debug('[%s] Prober error %s:\nstderr\n%s\nstdout\n%s',
      serviceName, probedResult.status,
      probedResult.stderr, probedResult.stdout)
    process.exit(probedResult.status)
  } else {
    try {
      var announcement = JSON.parse(probedResult.stdout)
      var ann = util.inspect(announcement, {
        colors: true,
        depth: 4
      })
      debug('[%s] service probed from network:', announcement.name, '\n', ann)
      ServiceClass = RemotePipe.buildServiceFromAnnouncement(announcement)
      if (ServiceClass.middleware)
        Router.rebuildRemoteMiddlewares(ServiceClass.middleware, ServiceClass)
    } catch (e) {
      debug('[%s] Error announcement data:\n', serviceName, probedResult.stdout.toString())
      return exports.remoteRequire(serviceName)
    }
  }

  return ServiceClass
}

exports.register = function(serviceInstance, name) {
  debug('[%s] register service', name)
  this.services[name] = serviceInstance
  return serviceInstance
}
