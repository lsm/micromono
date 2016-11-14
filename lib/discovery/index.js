var fs = require('fs')
var path = require('path')
var debug = require('debug')('micromono:discovery')
var assign = require('lodash.assign')
var Router = require('../web/router')
var spawnSync = require('child_process').spawnSync
var RemotePipe = require('../service/remote')


exports.require = function(serviceName, serviceDir) {
  var service
  var servicePath = serviceName
  serviceDir = serviceDir || this.serviceDir

  var ServiceClass = exports.localRequire(serviceName, serviceDir, this.services)

  if (false === ServiceClass) {
    debug('Failed to locate service [%s] locally, try to discover from network.', serviceName)
    ServiceClass = exports.remoteRequire(this, serviceName, serviceDir)
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
      debug('Resolved service [%s] path "%s"', serviceName, servicePath)
    }
    if (services[serviceName]) {
      debug('Service [%s] already required', serviceName)
      return services[serviceName]
    } else {
      debug('Require service [%s] from path "%s"', serviceName, servicePath)
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

exports.remoteRequire = function(micromono, serviceName, serviceDir) {
  var proberPath
  var ServiceClass
  var proberCommand
  var discoveryOptions = exports.getDiscoveryOptions(micromono)

  var args = ['--discovery-target', serviceName]
  args = args.concat(process.argv.slice(2))

  if (discoveryOptions.MICROMONO_DISCOVERY_AGENT_PATH) {
    // Customized discovery agent.
    proberCommand = discoveryOptions.MICROMONO_DISCOVERY_AGENT_PATH
    // Tell the child process this suppose to be a discovery agent.
    args.push('--discovery-agent')
  } else {
    // Use default discovery agent.
    proberPath = require.resolve('./prober')
    proberCommand = 'node'
    args.unshift(proberPath)
  }

  debug('Probing service [%s] using command: "%s %s"', serviceName, proberCommand, args.join(' '))

  var probedResult = spawnSync(proberCommand, args, {
    env: assign({}, process.env, discoveryOptions),
    stdio: ['inherit', 'pipe', 'inherit']
  })

  if (255 === probedResult.status) {
    debug('Stopped discovering service [%s]\n', serviceName)
    process.exit(probedResult.status)
  } else if (0 !== probedResult.status) {
    debug('Service [%s] probing error %s:\n\t%s\n',
      serviceName, probedResult.status, probedResult.stdout)
    process.exit(probedResult.status)
  } else {
    try {
      var announcement = JSON.parse(probedResult.stdout)
      debug('Service [%s@%s] probed from network', announcement.name, announcement.version)
      ServiceClass = RemotePipe.buildServiceFromAnnouncement(announcement)
      if (ServiceClass.middleware)
        Router.rebuildRemoteMiddlewares(ServiceClass.middleware, ServiceClass)
    } catch (e) {
      debug('Service [%s] invalid announcement data:\n', serviceName, probedResult.stdout.toString())
      return exports.remoteRequire(micromono, serviceName, serviceDir)
    }
  }

  return ServiceClass
}

exports.register = function(serviceInstance, name) {
  debug('Register instance of service [%s]', name)
  this.services[name] = serviceInstance
  return serviceInstance
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
