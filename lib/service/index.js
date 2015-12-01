/**
 * Module dependencies.
 */
var RPC = require('../rpc')
var path = require('path')
var util = require('util')
var argv = require('../argv').parse(process.argv)
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
  this.announcement = new Announcement(this)
  this.setDefaults(this.packageInfo)


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
  if (this.use || this.route || this.asset || this.middleware) {
    this.framework = this.framework || 'express'
    this.router = new Router(this)
    this.app = this.router.framework.getApp()
    this.announcement.use = this.router.getUses()
  }
}

Service.prototype.setupRPC = function() {
  if (!this.api) {
    this.api = {}
  }

  // We need at least one api for heartbeating.
  this.api.__ping = function(msg, callback) {
    callback('pong')
  }

  this.rpcType = this.rpcType || 'axon'
  var rpcOptions = {
    api: this.api,
    type: this.rpcType,
    context: this,
    isRemote: false
  }
  this.rpc = new RPC(rpcOptions)
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
  debug('[%s] get http server', this.name)
  this.server = server
  this.emit('server', server)
}

/**
 * Set the upgrade url or get the upgrade url with base url prefixed.
 *
 * @param  {String|undefined} upgradeUrl Set the upgrade url when this is string
 * or return the current value if this is undefined.
 * @return {String}           Value of current upgrade url.
 */
Service.prototype.allowUpgrade = function(upgradeUrl) {
  if ('undefined' === typeof upgradeUrl) {
    if (this.announcement.upgradeUrl) {
      upgradeUrl = this.announcement.upgradeUrl
    } else if (this.upgradeUrl) {
      upgradeUrl = this.upgradeUrl
    }
  }

  if (upgradeUrl) {
    upgradeUrl = path.join('/', upgradeUrl)
    return path.join(this.baseUrl, (this.announcement.upgradeUrl = upgradeUrl))
  }
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
  debug('[%s] startWebServer()', this.name)

  if (!this.router) {
    // no need to start http server if we don't have asset or route to serve.
    debug('[%s] no need to start web server', this.name)
    return Promise.resolve()
  }

  var self = this
  host = host || '0.0.0.0'
  port = port || 0

  debug('[%s] start web server at %s:%s', this.name, host, port)

  return this.router.startServer(port, host).then(function(server) {
    if (server) {
      var address = server.address()
      self.announcement.webPort = address.port
      debug('[%s] web server started at %s:%s', self.name, address.address, address.port)

      // Make sure listeners in `init()` could get this event.
      process.nextTick(function() {
        self.setHttpServer(server)
      })
    }
  })
}

Service.prototype.startRPCServer = function(port, host) {
  host = host || '0.0.0.0'
  port = port || 0
  var self = this
  debug('[%s] start "%s" rpc server at %s:%s', this.name, this.rpc.type, host, port)
  return this.rpc.startServer(port, host).then(function(server) {
    var address = server.address()
    self.announcement.rpcPort = address.port
    debug('[%s] "%s" rpc server started at %s:%s',
      self.name,
      self.rpc.type,
      address.address,
      address.port
    )
  })
}

Service.prototype.run = function(options) {
  var name = this.name
  debug('[%s] run service', name)
  options = options || {}
  var self = this
  var ann = this.announcement
  ann.name = name
  ann.version = this.version

  var promise = this.startWebServer(options.port, options.host)
    .then(function() {
      debug('[%s] init() service ', name)
      return self.init()
    })
    .then(function() {
      if (self.asset) {
        debug('[%s] setup static asset', name)
        ann.asset = self.asset.parseJSPM()

        // make sure we have a consistent package name
        ann.asset.name = name
        self.asset.pkgInfo.name = name

        if (argv.bundleAsset) {
          return self.asset.bundle({
            bundleDeps: false
          }, process.env.NODE_ENV)
        }
      }
    })
    .then(function() {
      if (self.router) {
        debug('[%s] setup router & middleware', name)
        // build and attach route handlers
        self.router.attachRoutes()
        ann.use = self.router.getUses()
        ann.route = self.router.getRoutes()
        ann.middleware = self.router.getMiddlewares()
      }
    })
    .then(function() {
      if (self.rpc && !isNaN(+options.rpcPort)) {
        // only when a real port is provided
        debug('[%s] setup rpc ', name)
        ann.rpc = self.rpc.getAPIs()
        ann.rpcType = self.rpcType
        ann.rpcPort = options.rpcPort
        return self.startRPCServer(options.rpcPort, options.rpcHost)
      }
    })
    .then(function() {
      var annStr = util.inspect(ann, {
        colors: true,
        depth: 4
      })
      debug('[%s] service started with announcement: \n%s\n', name, annStr)
    })

  return promise
}
