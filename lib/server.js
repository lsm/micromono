/**
 * Module dependencies
 */

var path = require('path')
var Asset = require('./web/asset')
var debug = require('debug')('micromono:server')
var Router = require('./web/router')
var argv = require('cmdenv')('micromono')
var ServiceManager = require('./service/manager')

/**
 * Parse commmand line and environment options
 */
argv
  .option('-s --service [services]', 'Names of services to require. Use comma to separate multiple services. (e.g. --service account,cache) Env name: MICROMONO_SERVICE')
  .option('-d --service-dir [dir]', 'Directory of locally available services. Env name: MICROMONO_SERVICE_DIR')
  .option('-w --allow-pending', 'White list mode - allow starting the balancer without all required services are loaded/probed.')
  .option('-p --port [port]', 'The http port which balancer binds to.', '8383')
  .option('--host [host]', 'The host which balancer/service binds to.')
  .option('--web-port [port]', 'The http port which service binds to.')
  .option('--rpc-port [port]', 'The port which service binds the rpc server to.')
  .parse(process.argv)

var PORT = argv.port
var HOST = argv.host
var SERVICE = argv.service
var SERVICE_DIR = argv.serviceDir
var ALLOW_PENDING = argv.allowPending

/**
 * Constructor for MicroMonoServer class
 *
 * @return {MicroMonoServer} Instance of MicroMonoServer class
 */
var MicroMonoServer = module.exports = function(options) {
  this.options = this.getDefaultOptions(options)
  this.parsePackageInfo(this.options.packagePath)
  Router.prototype.setFramework.call(this, this.options.framework)

  this.manager = new ServiceManager({
    allowPending: ALLOW_PENDING,
    serviceDir: SERVICE_DIR
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
  var asset = this.asset
  var manager = this.manager
  var framework = this.framework

  if (SERVICE) {
    var services = SERVICE.split(',')
      // Load services required from command line.
    services.forEach(function(name) {
      self.require(name)
    })
  }

  if (app) {
    PORT = app
    framework.setApp(app)
  }

  var promise = manager.runServices(this)

  if (asset) {
    promise = promise.then(function() {
      return asset.configJSPM()
    })

    if (asset.publicURL && asset.publicPath) {
      // Serve local asset files.
      promise = promise.then(function() {
        framework.serveStatic(asset.publicURL, asset.publicPath)
      })
    }
  }

  return promise
    .then(function() {
      return framework.startServer(PORT, HOST, manager).then(function(server) {
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
      debug('micromono started with error:', e.stack)
    })
}
