/**
 * Module dependencies.
 */
var RPC = require('../rpc')
var path = require('path')
var util = require('util')
var Asset = require('../web/asset')
var debug = require('debug')('micromono:service')
var Router = require('../web/router')
var assign = require('lodash.assign')
var extend = require('ampersand-class-extend')
var EventEmitter = require('eventemitter3')
var Announcement = require('../announcement')


/**
 * MicroMono Service class constructor.
 */
var Service = module.exports = function MicroMonoService() {
  if (!this.packagePath) {
    throw new Error('Please provide `packagePath` property when you extend Service class')
  }

  this.packageInfo = require(path.join(this.packagePath, 'package.json'))
  this.setDefaults(this.packageInfo)
  this.announcement = new Announcement(this)

  this.setupAsset()
  this.setupWeb()
  this.setupRPC()

  if (!this.init) {
    this.init = function() {
      return Promise.resolve()
    }
  }
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

Service.prototype.setupAsset = function() {
  if (this.packageInfo.jspm) {
    // found jspm info, initialize Asset
    this.asset = new Asset(this.packagePath)
  }
}

Service.prototype.setupWeb = function() {
  if (this.route || this.asset || this.middleware) {
    this.framework = this.framework || 'express'
    this.router = new Router(this)
    this.app = this.router.framework.getApp()
  }
}

Service.prototype.setupRPC = function() {
  if (this.api) {
    this.rpcType = this.rpcType || 'axon'
    var rpcOptions = {
      api: this.api,
      type: this.rpcType,
      context: this,
      isRemote: false
    }
    this.rpc = new RPC(rpcOptions)
  }
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
  debug('startWebServer()')
  if (!this.router) {
    // no need to start http server if we don't have asset or route to serve.
    debug('no need to start web server')
    return Promise.resolve()
  }

  var self = this
  host = host || '0.0.0.0'
  port = port || 0

  debug('start web server at %s:%s', host, port)

  return this.router.startServer(port, host).then(function(server) {
    if (server) {
      port = server.address().port
      self.announcement.webPort = port
      debug('web server started at %s:%s', host, port)

      self.setHttpServer(server)
    }
  })
}

Service.prototype.startRPCServer = function(port, host) {
  host = host || '0.0.0.0'
  port = port || 0
  debug('start rpc server type %s at %s:%s', this.rpc.type, host, port)
  return this.rpc.startServer(port, host)
}

Service.prototype.run = function(options) {
  debug('run service "%s" with options', this.name, options)
  options = options || {}
  var self = this
  var ann = this.announcement

  var promise = this.startWebServer(options.port, options.host)
    .then(function() {
      debug('init()')
      return self.init()
    })
    .then(function() {
      if (self.router) {
        debug('setup router & middleware')
        if (self.asset) {
          debug('setup asset')
          ann.asset = self.asset.parseJSPM()

          // make sure we have a consistent package name
          ann.asset.name = self.name
          self.asset.pkgInfo.name = self.name
        }

        // build and attach route handlers
        self.router.buildRoutes()
        ann.route = self.router.getRoutes()
        ann.middleware = self.router.getMiddlewares()
      }
    })
    .then(function() {
      if (self.rpc) {
        debug('setup rpc')
        ann.rpc = this.rpc.getAPIs()
        ann.rpcType = this.rpcType
        ann.rpcPort = options.rpcPort
        return self.startRPCServer(options.rpcPort, options.rpcHost)
      }
    })
    .then(function() {
      var ann = util.inspect(self.announcement, {
        colors: true,
        depth: 4
      })
      debug('service "%s" started with announcement: \n%s\n', self.name, ann)
    })

  return promise
}
