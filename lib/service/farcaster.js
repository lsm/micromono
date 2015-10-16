/**
 * Farcaster is the module for rebuilding a remote service into a local accessible
 * service class.
 */

/**
 * Module dependencies.
 */


var Asset = require('../web/asset')
var debug = require('debug')('micromono:service')
var assign = require('lodash.assign')
var Service = require('./service')
var toArray = require('lodash.toarray')
var shortid = require('shortid')
var EventEmitter = require('eventemitter3')


var Farcaster = module.exports = {}

/**
 * Rebuild the remote API to a local class based on serivce announcement.
 *
 * @param  {Object} serviceAnnouncement Service announcement information loaded from network.
 * @return {Service}
 */
Farcaster.build = function(serviceAnnouncement) {
  var serviceProto = {

    isRemote: function() {
      return true
    },

    constructor: function() {
      var ann = this.announcement = serviceAnnouncement
      this.baseUrl = this.announcement.baseUrl
      this.callbacks = {}
      this.providers = []
      this.emitter = new EventEmitter()

      if (ann.api && ann.rpcPort && ann.rpcType) {
        var rpcClient = require('./rpc/' + ann.rpcType).client
        assign(this, rpcClient)
      }

      if (ann.route) {
        this.route = ann.route;
      }

      if (ann.asset) {
        this.asset = new Asset(ann.asset)
      }

      buildMiddlewares(this, ann.middleware)
    },

    generateID: function() {
      var id = shortid.generate()

      if (!this.callbacks[id]) {
        this.callbacks[id] = null
        return id
      } else {
        return this.generateID()
      }
    },

    run: function(app) {
      if (app) {
        this.express(app)
      }

      if (this.router) {
        // load route handlers
        this.router.getRoutes()
      }

      this.addProvider(this.announcement)

      return Promise.resolve()
    },

    addProvider: function(ann) {
      if (this.hasProvider(ann)) {
        return
      }

      debug('new provider for service `%s` found at %s', ann.name, ann.address)

      if (ann.api && ann.rpcPort) {
        this.connect(ann)
      }

      this.providers.push(ann)
    },

    hasProvider: function(ann) {
      var found = this.providers.some(function(provider) {
        if (ann.address && provider.address === ann.address) {
          if (ann.rpcPort && provider.rpcPort === ann.rpcPort) {
            return true
          }
          if (ann.webPort && provider.webPort === ann.webPort) {
            return true
          }
          if (ann.middlewarePort && provider.middlewarePort === ann.middlewarePort) {
            return true
          }
        }
      })
      return found
    },

    scheduleProvider: function(callback) {
      var provider = this.providers.shift()
      callback(provider)
      this.providers.push(provider)
    },

    onProviderDisconnect: function(provider) {
      var idx = this.providers.indexOf(provider)
      if (idx > -1) {
        delete this.providers[idx]
      }
    }
  }

  buildAPIs(serviceProto, serviceAnnouncement.api)
  return Service.extend(serviceProto)
}


/**
 * Private helper functions
 */

function buildAPIs(proto, apis) {
  if (apis) {
    Object.keys(apis).forEach(function(apiName) {
      proto[apiName] = function() {
        var args = toArray(arguments)
        var data = {
          name: apiName,
          args: args
        }
        this.send(data)
      }
    })
  }
}

function buildMiddlewares(service, middlewares) {
  if (middlewares) {
    var middleware = {}

    Object.keys(middlewares).forEach(function(name) {
      // a place holder, the actual handler will be set by framework adapter
      middleware[name] = null
    })

    service.middleware = middleware
  }
}
