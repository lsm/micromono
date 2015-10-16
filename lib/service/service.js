/**
 * Module dependencies.
 */

var path = require('path')
var Asset = require('./asset')
var debug = require('debug')('micromono:service')
var Router = require('./router')
var assign = require('lodash.assign')
var extend = require('ampersand-class-extend')
var express = require('express')
var getFnArgs = require('./helper').getFnArgs
var randomPort = require('random-port')
var EventEmitter = require('eventemitter3')
var Announcement = require('./announcement')


/**
 * Module constants
 */

var RPC_PORT_RANGE = {
  from: 16262,
  range: 10000
}
var WEB_PORT_RANGE = {
  from: 36262,
  range: 10000
}


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

  if (this.packageInfo.jspm) {
    // found jspm info, initialize Asset
    this.asset = new Asset(this.packagePath)
    this.announcement.asset = this.asset.parseJSPM()
    // make sure we have the same name
    this.announcement.asset.name = this.name
    this.asset.pkgInfo.name = this.name
  }

  if (this.route || this.asset || this.middleware) {
    this.framework = this.framework || 'express'
    this.router = new Router(this)
    this.app = this.router.framework.getApp()
  }

  var api = getAPIInfo(this)
  if (Object.keys(api).length > 0) {
    this.announcement.api = api
    assign(this, require('./rpc/axon').server)
  }

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

/**
 * Get the type of the service instance, remote or not.
 *
 * @return {Boolean} True if this is a remote service (farcaster), otherwise false.
 */
Service.prototype.isRemote = function() {
  return false
}

Service.prototype.setHttpServer = function(server) {
  this.server = server
  this.emit('server', server)
}

Service.prototype.allowUpgrade = function(upgradeUrl) {
  if (upgradeUrl === undefined) {
    return this.announcement.upgradeUrl
  } else if (upgradeUrl) {
    upgradeUrl = path.join(this.baseUrl, upgradeUrl)
  }
  return (this.announcement.upgradeUrl = upgradeUrl)
}

/**
 * MicroMono Service public API.
 *
 * @type {Object}
 */
Service.prototype = {

  express: function(app) {
    var router = this.router

    if (router) {
      if (router.assetApp) {
        app.use(router.assetApp)
      }

      if (router.routeApp) {
        app.use(this.baseUrl, router.routeApp)
      }

      if (router.middlewareApp) {
        app.use(router.middlewareApp)
      }
    }
  },

  startWebServer: function(host) {
    if (!this.router) {
      // no need to start http server if we don't have asset or route to serve.
      return Promise.resolve()
    }

    return this.router.startServer(0, host)

    var self = this
    return this.getRandomPort(WEB_PORT_RANGE).then(function(port) {
      var mainApp = express()
      self.express(mainApp)
      self.mainApp = mainApp
      self.announcement.webPort = port

      var promise = new Promise(function(resolve, reject) {
        self.server = mainApp.listen(port, host, function(error) {
          error ? reject(error) : resolve()
        })
        self.setHttpServer(self.server)
      })

      return promise
    })
  },

  getRandomPort: function(range) {
    range = range || RPC_PORT_RANGE
    var promise = new Promise(function(resolve, reject) {
      randomPort(range, function(port) {
        resolve(port)
      })
    })
    return promise
  },

  encodeData: function(data) {
    return JSON.stringify(data)
  },

  decodeData: function(msg) {
    return JSON.parse(msg)
  },

  getHandler: function(name) {
    return this.announcement.api[name].handler
  },

  run: function(app) {
    var self = this

    var promise = this.startWebServer(app)
      .then(function() {
        return self.init()
      })
      .then(function() {
        if (self.router) {
          // load route handlers
          self.announcement.route = self.router.getRoutes()
          self.announcement.middleware = self.router.getMiddlewares()
        }
      })
      .then(function() {
        if (self.announcement.api) {
          return self.getRandomPort().then(function(port) {
            return self.startRPCServer(port)
          })
        }
      })
      .then(function() {
        debug('Service "%s" started with following service info: ', self.announcement.name)
        debug(self.announcement)
      })

    return promise
  }
}

/**
 * MicroMonoService private functions.
 */

var API_BLACK_LIST = ['constructor', 'init', 'app'].concat(Object.keys(Service.prototype))

/**
 * [getAPIInfo description]
 * @return {Object} [description]
 */
function getAPIInfo(service) {
  var _apis = {}
  for (var name in service) {
    if (API_BLACK_LIST.indexOf(name) === -1 && name[0] !== '_') {
      var fn = service[name]
      if (typeof fn === 'function') {
        var args = getFnArgs(fn)
        _apis[name] = {
          name: name,
          args: args,
          handler: fn
        }
      }
    }
  }
  return _apis
}
