var path = require('path')
var util = require('util')
var debug = require('debug')('micromono:discovery:require')
var spawnSync = require('child_process').spawnSync
var RemotePipe = require('../service/remote')


exports.require = function require(serviceName) {
  var service
  var ServiceClass
  var _name = serviceName

  try {
    if (this.serviceDir) {

      serviceName = path.resolve(this.serviceDir, serviceName)
      debug('[%s] resolved path "%s"', _name, serviceName)
    }
    if (this.services[_name]) {
      debug('[%s] service already required', _name)
      return this.services[_name]
    } else {
      debug('[%s] require service from path "%s"', _name, serviceName)
      ServiceClass = require(serviceName)
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
      ServiceClass = RemotePipe.buildServiceFromAnnouncement(announcement).service
    }
  }

  if ('function' === typeof ServiceClass) {
    service = new ServiceClass()
  } else {
    service = ServiceClass
  }

  this.register(ServiceClass, _name)

  return service
}

exports.register = function(serviceInstance, name) {
  debug('[%s] register service', name)
  this.services[name] = serviceInstance
  return serviceInstance
}
