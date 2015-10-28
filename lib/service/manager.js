var path = require('path')
var http = require('http')
var util = require('util')
var argv = require('cmdenv')('micromono')
var async = require('async')
var debug = require('debug')('micromono:service:manager')
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
  this.services = {}
  this.serviceDir = options.serviceDir
  this.remoteServices = []

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
  var ServiceFactory
  var _name = serviceName

  try {
    if (this.serviceDir) {

      serviceName = path.resolve(this.serviceDir, serviceName)
      debug('resolved path for service "%s": %s', _name, serviceName)
    }
    if (this.services[_name]) {
      debug('service "%s" already required', _name)
      return this.services[_name]
    } else {
      debug('require service "%s" from path "%s"', _name, serviceName)
      ServiceClass = require(serviceName)
    }
  } catch (e) {
    debug('Failed to locate service "%s" locally', serviceName, '\n', e.stack)
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
      debug('service "%s" probed from network:', announcement.name, '\n', ann)
      ServiceClass = Farcaster.build(announcement)
    }
  }

  if (ServiceClass !== Service) {
    ServiceFactory = this.register(ServiceClass, _name)
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
    this.mainService = this.register(ServiceClass)
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
      var ServiceFactory = self.services[name]
      self.runService(server, ServiceFactory)
        .then(function(serviceInstance) {
          if (serviceInstance.isRemote()) {
            self.remoteServices.push(serviceInstance.name)
          } else if (!server) {
            // only announce when we are running as a service in standalone process
            debug('start announcing "%s" service', serviceInstance.name)
            discovery.announce(serviceInstance.announcement)
          }
          callback()
        })
        .catch(callback)
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
ServiceManager.prototype.runService = function(server, ServiceFactory) {
  var serviceInstance = new ServiceFactory()
  var ann = serviceInstance.announcement

  debug('[%s] runService()', serviceInstance.name)

  var framework
  if (server) {
    debug('[%s] runService() with server', serviceInstance.name)
    framework = server.framework
  }

  if (ann.use && framework) {
    Object.keys(ann.use).forEach(function(middlewareName) {
      var url = ann.use[middlewareName]
      debug('[%s] use middleware "%s" with url "%s"', serviceInstance.name, middlewareName, url)
      var _middlewareName = framework.type + '-' + middlewareName

      var middleware
      try {
        debug('[%s] try to load internal middleware "%s"', serviceInstance.name, _middlewareName)
        middleware = require('../web/middleware/' + _middlewareName)
      } catch (e) {
        middleware = require(middlewareName)
      }

      framework.useMiddleware(url, middleware, serviceInstance)
    })
  }

  var serviceOptions = {
    port: 0
  }

  if (this.mainService === ServiceFactory) {
    // this is the main service, passing cmdenv options to it
    serviceOptions.port = argv.port || 0
    serviceOptions.host = argv.host || '0.0.0.0'

    serviceOptions.rpcPort = argv.rpcPort || 0
    serviceOptions.rpcHost = argv.rpcHost || '0.0.0.0'
  }

  if (framework) {
    serviceOptions.port = framework.getApp()
  }

  var promise = serviceInstance.run(serviceOptions).then(function() {
    if (server && server.asset && ann.asset) {
      debug('[%s] merge asset with server', ann.name)
      server.asset.mergeJSPMDeps(ann.asset)
    }
    return Promise.resolve(serviceInstance)
  })

  return promise
}

/**
 * Listen for new service providers only when we have remote services.
 *
 * @param  {MicroMonoServer} [server] Optional instance of MicroMonoServer.
 */
ServiceManager.prototype.listenProviders = function(server) {
  if (this.remoteServices.length > 0) {
    debug('start listening providers for remote services:', this.remoteServices)
    var self = this
    discovery.listen(function(err, announcement, rinfo) {
      if (announcement && announcement.name) {
        var serviceName = announcement.name

        var ServiceFactory = self.services[serviceName] || self.require(serviceName)
        if (self.pendingServices && self.pendingServices[serviceName]) {
          // Found pending service.
          if (ServiceFactory !== Service) {
            // Initialize and run the service.
            self.runService(server, ServiceFactory)
          }
        } else {
          var serviceInstance = new ServiceFactory()
          if (serviceInstance && serviceInstance.isRemote()) {
            // Only remote probed service has the ability to add provider.
            serviceInstance.addProvider(announcement)
          }
        }
      }
    })
  }
}

/**
 * Register and initialize a service class
 *
 * @param  {Service}  ServiceClass Constructor of service class
 * @return {Function}              A singletonified service class.
 */
ServiceManager.prototype.register = function(ServiceClass, name) {
  var ServiceFactory = singletonify(ServiceClass)

  if (!name) {
    var instance = new ServiceFactory()
    name = instance.name
  }

  debug('register service "%s"', name)

  this.services[name] = ServiceFactory

  if (this.pendingServices) {
    delete this.pendingServices[name]
  }

  return ServiceFactory
}

/**
 * Set http server to all services it manages.
 *
 * @param {http.Server} httpServer Native node http.Server instance.
 */
ServiceManager.prototype.setHttpServer = function(httpServer) {
  if (!httpServer || !(httpServer instanceof http.Server)) {
    throw new Error('Instance of http.Server is required for setting http server.', httpServer)
  }
  var services = this.services
  Object.keys(services).forEach(function(serviceName) {
    var ServiceClass = services[serviceName]
    var service = new ServiceClass()
    debug('[%s] set http server', service.name)
    service.setHttpServer(httpServer)
  })
}
