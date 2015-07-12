/**
 * Farcaster is the module for rebuilding a remote service into a local accessible
 * service class.
 */

/**
 * Module dependencies.
 */

var Router = require('./router');
var Service = require('./service');
var toArray = require('lodash.toarray');
var shortid = require('shortid');
var Connector = require('./connector');


var Farcaster = module.exports = {};

/**
 * Rebuild the remote API to a local class based on serivce announcement.
 *
 * @param  {Object} serviceAnnouncement Service announcement information loaded from network.
 * @return {Service}
 */
Farcaster.build = function(serviceAnnouncement) {
  var serviceProto = {

    isRemote: function() {
      return true;
    },

    constructor: function() {
      this.announcement = serviceAnnouncement;
      this.baseUrl = this.announcement.baseUrl;
      this.callbacks = {};

      if (serviceAnnouncement.route || serviceAnnouncement.client) {
        this.router = new Router(this);
      }

      this.connector = new Connector();
      this.connector.on('message', this.dispatch.bind(this));
    },

    generateID: function() {
      var id = shortid.generate();

      if (!this.callbacks[id]) {
        this.callbacks[id] = null;
        return id;
      } else {
        return this.generateID();
      }
    },

    send: function(data) {
      var args = data.args;

      if (typeof args[args.length - 1] === 'function') {
        // last argument is a callback function, add callback identity to data
        var cid = this.generateID();
        data.cid = cid;
        this.callbacks[cid] = args.pop();
      }

      var msg = this.encodeData(data);
      this.connector.send(msg);
    },

    dispatch: function(msg) {
      var data = this.decodeData(msg);

      if (data.cid) {
        var args = data.args;
        var callback = this.callbacks[data.cid];
        if (typeof callback === 'function') {
          callback.apply(this, args);
        }
      }
    },

    run: function(app) {
      if (app) {
        this.express(app);
      }

      this.addProvider(this.announcement);

      return Promise.resolve();
    },

    addProvider: function(ann) {
      this.connector.connect(ann);
    }
  };

  buildAPIs(serviceProto, serviceAnnouncement.api);

  return Service.extend(serviceProto);
};


/**
 * Private helper functions
 */

function buildAPIs(proto, apis) {
  Object.keys(apis).forEach(function(apiName) {
    proto[apiName] = function() {
      var args = toArray(arguments);
      var data = {
        name: apiName,
        args: args
      };
      this.send(data);
    };
  });
}
