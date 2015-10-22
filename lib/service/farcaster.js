/**
 * Farcaster is the module for rebuilding a remote service into a local accessible
 * service class.
 */

/**
 * Module dependencies.
 */

var RPC = require('../rpc')
var Asset = require('../web/asset')
var debug = require('debug')('micromono:service-farcaster')
var Service = require('./index')
var Scheduler = require('../scheduler')


var Farcaster = module.exports = {}

/**
 * Rebuild the remote API to a local class based on serivce announcement.
 *
 * @param  {Object} serviceAnnouncement Service announcement information loaded from network.
 * @return {Service}
 */
Farcaster.build = function(serviceAnnouncement) {
  var serviceProto = {

    announcement: serviceAnnouncement,

    isRemote: function() {
      return true
    },

    constructor: function() {
      this.setDefaults(this.announcement)
      this.scheduler = new Scheduler()

      this.setupWeb()
      this.setupRPC(this.announcement)
    },

    setDefaults: function(ann) {
      this.name = ann.name
      this.baseUrl = ann.baseUrl
      this.version = ann.version

      if (ann.asset) {
        this.asset = new Asset(ann.asset)
      }

      this.route = ann.route;
      this.middleware = ann.middleware
    },

    setupRPC: function(ann) {
      if (ann.rpc && ann.rpcType && ann.rpcPort && ann.address) {
        var rpcOptions = {
          api: ann.rpc,
          type: ann.rpcType,
          context: null,
          isRemote: true,
          scheduler: this.scheduler
        }
        this.rpc = new RPC(rpcOptions)
        this.api = this.rpc.getAPIs()
        this.rpcType = ann.rpcType
      }
    },

    run: function(options) {
      debug('run local version of remote service "%s"', this.name)
      if (isNaN(+options.port)) {
        this.router.startServer(options.port)
      }

      if (this.router) {
        this.router.buildRoutes()
      }

      this.addProvider(this.announcement)

      return Promise.resolve()
    },

    addProvider: function(ann) {
      debug('add provider', this.name)
      if (this.hasProvider(ann)) {
        return
      }

      debug('new provider for service `%s` found at %s', ann.name, ann.address)

      if (this.rpc) {
        this.rpc.connect(ann)
      }

      this.scheduler.add(ann)
    },

    hasProvider: function(ann) {
      return this.scheduler.hasItem(ann, function(old, ann) {
        if (old.address && ann.address === old.address) {
          if (old.rpcPort && ann.rpcPort === old.rpcPort) {
            return true
          } else if (old.webPort && ann.webPort === old.webPort) {
            return true
          }
        }
      })
    },

    onProviderDisconnect: function(provider) {
      this.scheduler.remove(provider)
    }
  }

  return Service.extend(serviceProto)
}
