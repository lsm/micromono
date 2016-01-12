var path = require('path')
var http = require('http')
var util = require('util')
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
  this.argv = require('../argv')
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
 * Run required services with optional server.
 *
 * @param  {MicroMonoServer} [server] Optional instance of MicroMonoServer.
 * @return {Promise}                  Instance of promise.
 */
ServiceManager.prototype.runServices = function(server) {
  var self = this

  return new Promise(function(resolve, reject) {
    async.eachSeries(Object.keys(self.services), function(name, callback) {
      var ServiceFactory = self.services[name];
      self.runService(server, ServiceFactory)
        .then(function(serviceInstance) {
          if (serviceInstance.isRemote()) {
            self.remoteServices.push(serviceInstance.name)
          } else if (!server) {
            // only announce when we are running as a service in standalone process
            debug('[%s] start announcing service', serviceInstance.name)
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

  function loadMiddleware(name, service, framework) {
    var _middlewareName = framework ? framework.type + '-' + name : name
    try {
      debug('[%s] try to load internal middleware "%s"', service.name, _middlewareName)
      return require('../web/middleware/' + _middlewareName)
    } catch (e) {
      return require(name)
    }
  }

  if (ann.use && framework) {
    Object.keys(ann.use).forEach(function(middlewareName) {
      var url = ann.use[middlewareName];

      debug('[%s] use middleware "%s"', serviceInstance.name, middlewareName)

      var middleware = loadMiddleware(middlewareName, serviceInstance, framework)
      framework.useMiddleware(url, middleware, serviceInstance)
    })
  }

  var serviceOptions = {
    port: 0
  }

  if (server && serviceInstance.router) {
    // We are in balancer mode.
    // Attach route specific middlewares.
    var routes = serviceInstance.router.getRoutes()

    if (routes) {
      Object.keys(routes).forEach(function(routePath) {
        var route = routes[routePath];
        if (Array.isArray(route.middleware)) {
          var middlewares = []
          route.middleware.forEach(function(m) {
            if ('string' === typeof m) {
              m = loadMiddleware(m, serviceInstance, framework)
              m = m(framework.getApp())
            }
            if ('function' === typeof m) {
              middlewares.push(m)
            }
          })
          route.middleware = middlewares
        }
      })
    }
  }

  if (this.mainService === ServiceFactory) {
    var argv = this.argv
    // this is the main service, passing cmdenv options to it
    serviceOptions.port = argv.port || 0
    serviceOptions.host = argv.host || '0.0.0.0'

    serviceOptions.rpcPort = argv.rpcPort || 0
    serviceOptions.rpcHost = serviceOptions.host
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
