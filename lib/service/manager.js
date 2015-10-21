var path = require('path')
var util = require('util')
var async = require('async')
var debug = require('debug')('micromono:service')
var Service = require('./index')
var discovery = require('../discovery/udp')
var Farcaster = require('./farcaster')
var spawnSync = require('child_process').spawnSync
var singletonify = require('../helper').singletonify

/**
 * Service manager manages services, local and/or remote.
 *
 * @param  {Object} options Options for the service manager:
 * {
 *   serviceDir: '/path/to/services', // Local path where we can find services.
 *   allowPending: false // Allow services pending for probing.
 * }
 * @return {ServiceManager}           Instance of ServiceManager.
 */
var ServiceManager = module.exports = function(options) {
  this.instances = {}
  this.services = {}
  this.serviceDir = options.serviceDir

  if (options.allowPending) {
    var pendingServices = this.pendingServices = {}
    var id = setInterval(function() {
      var services = Object.keys(pendingServices)
      if (services.length > 0) {
        debug('Pending service(s): %s', services.join(', '))
      } else {
        clearInterval(id)
      }
    }, 2000)
  }
}

/**
 * Require and get the class of service.
 *
 * @param  {String} name Name of the service to require.
 * @return {Service}     The service constructor.
 */
ServiceManager.prototype.require = function(serviceName) {
  var ServiceClass

  try {
    if (this.serviceDir) {
      var _name = serviceName
      serviceName = path.resolve(this.serviceDir, serviceName)
      debug('resolved path for service "%s": %s', _name, serviceName)
    }
    if (this.getService(serviceName)) {
      return this.getService(serviceName)
    } else {
      ServiceClass = require(serviceName)
    }
  } catch (e) {
    debug('Failed to locate service "%s" locally', serviceName, e.stack)
    debug('Try probe service "%s" remotely', serviceName)
    var expectedMessage = 'Cannot find module \'' + serviceName + '\''
    if (e.code !== 'MODULE_NOT_FOUND' || e.message !== expectedMessage) {
      // throw error if we found the module which contains error.
      throw e
    }
    var probedResult = spawnSync('node', [require.resolve('../discovery/prober'), serviceName])
    if (probedResult.status !== 0) {
      if (this.pendingServices && probedResult.status === 100) {
        // probe timeout, save the name to pending services and continue
        ServiceClass = this.pendingServices[serviceName] = Service
      } else {
        throw new Error(probedResult.stderr.toString())
      }
    } else {
      var announcement = JSON.parse(probedResult.stdout)
      var ann = util.inspect(announcement, {
        colors: true,
        depth: 4
      })
      debug('service "%s" probed from network: \n%s\n', announcement.name, ann)
      ServiceClass = Farcaster.build(announcement)
    }
  }

  var ServiceFactory

  if (ServiceClass === Service) {
    // a pending service place holder
    ServiceFactory = Service
  } else {
    ServiceFactory = this.register(ServiceClass)
  }

  return ServiceFactory
}

/**
 * Start the service with a standalone internal server.
 *
 * @param  {Service} ServiceClass Service class.
 * @return {Promise}              Instance of promise.
 */
ServiceManager.prototype.startService = function(ServiceClass) {
  if ('function' === typeof ServiceClass) {
    this.register(ServiceClass)
  }

  return this.runServices()
}

/**
 * Run required services with optional server.
 *
 * @param  {MicroMonoServer} [server] Optional instance of MicroMonoServer.
 * @return {Promise}                  Instance of promise.
 */
ServiceManager.prototype.runServices = function(server) {
  var self = this

  return new Promise(function(resolve, reject) {
    async.each(Object.keys(self.services), function(name, callback) {
      var ServiceFactory = self.getService(name)
      self.runService(server, ServiceFactory, function(promise, serviceInstance) {
        // only announce when we are running as a service in standalone process
        if (!server && !serviceInstance.isRemote()) {
          promise = promise.then(function() {
            debug('start announcing "%s" service', serviceInstance.name)
            discovery.announce(serviceInstance.announcement)
          })
        }
        promise.then(callback).catch(callback)
      })
    }, function bootServicesFinished(err) {
      if (err) {
        debug('run services error', err && err.stack || err)
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Run a single service with optional server.
 *
 * @param  {MicroMonoServer} [server] Optional instance of MicroMonoServer.
 * @param  {Service} ServiceFactory   Singletonified service factory class.
 * @return {Promise}                  Instance of promise.
 */
ServiceManager.prototype.runService = function(server, ServiceFactory, callback) {
  var serviceInstance = new ServiceFactory()
  var ann = serviceInstance.announcement

  debug('run service "%s"', serviceInstance.name)

  var framework
  if (server) {
    debug('run service "%s" with server', serviceInstance.name)
    framework = server.framework

    if (server.asset) {
      server.asset.mergeJSPMDeps(ann.client)
      server.asset.configJSPM()
    }
  }

  if (ann.use && framework) {
    Object.keys(ann.use).forEach(function(middlewareName) {
      debug('use middleware "%s"', middlewareName)
      var url = ann.use[middlewareName]
      var _middlewareName = framework.type + '-' + middlewareName


      var middleware
      try {
        debug('try to load internal middleware "%s"', _middlewareName)
        middleware = require('../web/middleware/' + _middlewareName)
      } catch (e) {
        middleware = require(middlewareName)
      }

      framework.useMiddleware(url, middleware)
    })
  }

  var port = 0
  if (framework) {
    port = framework.getApp()
  }

  var promise = serviceInstance.run({
    port: port
  })

  callback && callback(promise, serviceInstance)
  return promise
}

/**
 * Listen for new service providers.
 *
 * @param  {MicroMonoServer} [server] Optional instance of MicroMonoServer.
 */
ServiceManager.prototype.listenProviders = function(server) {
  var self = this
  discovery.listen(function(err, announcement, rinfo) {
    if (announcement && announcement.name) {
      var serviceName = announcement.name
      if (self.pendingServices && self.pendingServices[serviceName]) {
        // Found pending service.
        var ServiceFactory = self.require(serviceName)
        if (ServiceFactory !== Service) {
          // Initialize and run the service.
          self.runService(server, ServiceFactory)
        }
      } else {
        var serviceInstance = self.getInstance(serviceName)
        if (serviceInstance && serviceInstance.isRemote()) {
          // Only remote probed service has the ability to add provider.
          serviceInstance.addProvider(announcement)
        }
      }
    }
  })
}

/**
 * Register and initialize a service class
 *
 * @param  {Service}  ServiceClass Constructor of service class
 * @return {Function}              A singletonified service class.
 */
ServiceManager.prototype.register = function(ServiceClass) {
  var ServiceFactory = singletonify(ServiceClass)

  var serviceInstance = new ServiceFactory()
  var name = serviceInstance.name

  this.instances[name] = serviceInstance
  this.services[name] = ServiceFactory

  if (this.pendingServices) {
    this.removePendingService(name)
  }

  return ServiceFactory
}

/**
 * Get an instance of a registered service.
 *
 * @param  {String} name            Name of the service.
 * @return {Service|undefined}      Instance of the service or undefined.
 */
ServiceManager.prototype.getInstance = function(name) {
  return this.instances[name]
}

/**
 * Get the singletonified version of service class.
 *
 * @param  {String} name            Name of the service.
 * @return {Service|undefined}      A singletonified service class.
 */
ServiceManager.prototype.getService = function(name) {
  return this.services[name]
}

/**
 * Remove the service from internal pending list.
 *
 * @param  {String} name            Name of the service.
 */
ServiceManager.prototype.removePendingService = function(name) {
  delete this.pendingServices[name]
}
