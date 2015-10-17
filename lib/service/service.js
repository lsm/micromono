/**
 * Module dependencies.
 */

var RPC = require('../rpc')
var path = require('path')
var Asset = require('./asset')
var debug = require('debug')('micromono:service')
var Router = require('./router')
var assign = require('lodash.assign')
var extend = require('ampersand-class-extend')
var EventEmitter = require('eventemitter3')
var Announcement = require('./announcement')


/**
 * MicroMono Service class constructor.
 */
var Service = module.exports = function MicroMonoService() {
  if (!this.packagePath) {
    throw new Error('Please provide `packagePath` property when you extend Service class')
  }

  this.packageInfo = require(path.join(this.packagePath, 'package.json'))
  this.setDefaults(this.packageInfo)
  var ann = new Announcement(this)

  // setup asset
  if (this.packageInfo.jspm) {
    // found jspm info, initialize Asset
    this.asset = new Asset(this.packagePath)
    ann.asset = this.asset.parseJSPM()
      // make sure we have the same name
    ann.asset.name = this.name
    this.asset.pkgInfo.name = this.name
  }

  // setup web server
  if (this.route || this.asset || this.middleware) {
    this.framework = this.framework || 'express'
    this.router = new Router(this)
    this.app = this.router.framework.getApp()
  }

  // setup rpc
  if (this.api) {
    this.rpcType = this.rpcType || 'axon'
    this.rpc = new RPC({
      api: this.api,
      type: this.rpcType,
      context: this,
      isRemote: this.isRemote()
    })

    ann.rpc = this.rpc.getHandlers()
    ann.rpcType = this.rpc.type
  }

  if (!this.init) {
    this.init = function() {
      return Promise.resolve()
    }
  }

  this.announcement = ann
}

// Provide the ability to extend the Service class.
Service.extend = extend

// Service is an event emitter
assign(Service.prototype, EventEmitter.prototype)

/**
 * Set default options of the service
 *
 * @param {Object} info Object contains service information.
 */
Service.prototype.setDefaults = function(info) {
  this.name = this.name || info.name
  this.baseUrl = this.baseUrl || '/'
  this.version = info.version
}

/**
 * Get the type of the service instance, remote or not.
 *
 * @return {Boolean} True if this is a farcaster (a fake service rebuilt from
 * announcement of remote service), otherwise false.
 */
Service.prototype.isRemote = function() {
  return false
}

/**
 * Set the instance of native node http.Server instance
 *
 * @param {http.Server} server
 * @emit 'server' {http.Server}
 */
Service.prototype.setHttpServer = function(server) {
  this.server = server
  this.emit('server', server)
}

/**
 * Set or get upgrade url.
 *
 * @param  {String|undefined} upgradeUrl Set the upgrade url when this is string
 * or return the current value if this is undefined.
 * @return {String}           Value of current upgrade url.
 */
Service.prototype.allowUpgrade = function(upgradeUrl) {
  if ('undefined' === typeof upgradeUrl) {
    return this.announcement.upgradeUrl
  } else if (upgradeUrl) {
    upgradeUrl = path.join(this.baseUrl, upgradeUrl)
  }
  return (this.announcement.upgradeUrl = upgradeUrl)
}

/**
 * Start a web server which serves requests for route, asset and middleware
 * provided by this service.
 *
 * @param  {Number|String}  port Port to bind the server.
 * @param  {String}         host Host or ip address to bind the port to.
 * @return {Promise}        A promise instance rejects with error or resolve with
 * instance of http.Server when server started successfully.
 */
Service.prototype.startWebServer = function(port, host) {
  if (!this.router) {
    // no need to start http server if we don't have asset or route to serve.
    return Promise.resolve()
  }

  var self = this
  host = host || '0.0.0.0'
  this.announcement.webPort = port

  debug('start http server at %s:%s', host, port)

  return this.router.startServer(port, host).then(function(server) {
    if (server) {
      self.setHttpServer(server)
    }
  })
}

Service.prototype.startRPCServer = function(port, host) {
  host = host || '0.0.0.0'
  debug('start rpc server type %s at %s:%s', this.rpc.type, host, port)
  return this.rpc.startServer(port, host)
}

Service.prototype.run = function(options) {
  var self = this

  var promise = this.startWebServer(options.port, options.host)
    .then(function() {
      return self.init()
    })
    .then(function() {
      if (self.router) {
        // build and attach route handlers
        self.router.buildRoutes()
        self.announcement.route = self.router.getRoutes()
        self.announcement.middleware = self.router.getMiddlewares()
      }
    })
    .then(function() {
      if (self.rpc) {
        return self.startRPCServer(options.rpcPort, options.rpcHost)
      }
    })
    .then(function() {
      debug('Service "%s" started with following service info: ', self.announcement.name)
      debug(self.announcement)
    })

  return promise
}
