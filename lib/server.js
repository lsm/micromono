/**
 * Module dependencies
 */

var path = require('path')
var Asset = require('./web/asset')
var debug = require('debug')('micromono:server')
var Router = require('./web/router')
var ServiceManager = require('./service/manager')


/**
 * Constructor for MicroMonoServer class
 *
 * @return {MicroMonoServer} Instance of MicroMonoServer class
 */
var MicroMonoServer = module.exports = function(options, argv) {
  this.argv = argv
  this.options = this.getDefaultOptions(options)
  this.parsePackageInfo(this.options.packagePath)
  Router.prototype.setFramework.call(this, this.options.framework)

  this.manager = new ServiceManager({
    allowPending: argv.allowPending,
    serviceDir: argv.serviceDir
  })
}

/**
 * Get default options for server.
 * @param {Object} [options] Optional options, it could have following values:
 * {
 *   packagePath: '/path/to/the/package', // Where your package.json is.
 *   framework: 'express', // Name or instance of your web framework.
 * }
 *
 * @type {Object}
 */
MicroMonoServer.prototype.getDefaultOptions = function(options) {
  options = options || {}

  if (!options.packagePath) {
    var parentFile = module.parent.parent.filename
    options.packagePath = path.dirname(parentFile)
  }

  if (!options.framework) {
    options.framework = 'express'
  }

  return options
}

/**
 * Parse and create asset instance for this server.
 *
 * @param  {String} packagePath Path to the package.
 */
MicroMonoServer.prototype.parsePackageInfo = function(packagePath) {
  this.asset = new Asset(packagePath)

  try {
    this.asset.parseJSPM()
  } catch (e) {
    debug('failed to parse package info', e)
  }
}

/**
 * Require a service.
 *
 * @param  {String} name Name of the service to require.
 * @return {Service}     The service constructor.
 */
MicroMonoServer.prototype.require = function(name) {
  return this.manager.require(name)
}

/**
 * Start the service with a standalone internal server.
 *
 * @param  {Service} ServiceClass Service class.
 * @return {Promise}              Instance of promise.
 */
MicroMonoServer.prototype.startService = function(ServiceClass) {
  var manager = this.manager
  debug('start service')
  return manager.startService(ServiceClass).then(function() {
    // Listen for new providers for existing or pending services.
    manager.listenProviders()
  })
}

/**
 * Start the server as a balancer.
 *
 * @param  {Object} [app] The instance provided by external web framework.
 * @return {Promise}      An instance of promise.
 */
MicroMonoServer.prototype.startBalancer = function(app) {
  var self = this
  var argv = this.argv
  var asset = this.asset
  var manager = this.manager
  var framework = this.framework
  manager.name = 'MicroMonoServiceManager'

  if (argv.service) {
    var services = argv.service.split(',')
    // Load services required from command line.
    services.forEach(function(name) {
      self.require(name)
    })
  }

  if (app) {
    argv.port = app
    framework.setApp(app)
  }

  var promise = manager.runServices(self)
    .then(function() {
      return asset.configJSPM()
    })
    .then(function() {
      if (argv.bundleAsset && asset.jspmInfo && asset.jspmInfo.main) {
        return asset.bundle(null, process.env.NODE_ENV)
      }
    })
    .then(function() {
      // Serve local asset files.
      framework.serveAsset(asset)
    })

  return promise
    .then(function() {
      return framework.startServer(argv.port, argv.host, manager).then(function(server) {
        if (server) {
          var address = server.address()
          debug('balancer started at %s:%s', address.address, address.port)
        }
      })
    })
    .then(function() {
      // Listen for new providers for existing or pending services.
      manager.listenProviders(self)
    })
    .catch(function(e) {
      debug('started with error:', e.stack)
    })
}
