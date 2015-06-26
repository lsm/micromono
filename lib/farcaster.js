/**
 * Farcaster is the module for rebuilding a remote service into a local accessible
 * service class.
 */

/**
 * Module dependencies.
 */
var Service = require('./service');
var toArray = require('lodash.toarray');
var shortid = require('shortid');
var zmq = require('zmq');

var Farcaster = module.exports = {};

/**
 * Rebuild the remote API to a local class based on serivce announcement.
 *
 * @param  {Object} serviceAnnouncement Service announcement information loaded from network.
 * @return {Service}
 */
Farcaster.build = function(serviceAnnouncement) {
  var serviceProto = {
    constructor: function() {
      this.announcement = serviceAnnouncement;
      this.callbacks = {};
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
      this.socket.send(msg);
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

    run: function() {
      var self = this;
      var ann = this.announcement;

      var promise = new Promise(function(resolve, reject) {
        var port = 'tcp://' + ann.address + ':' + ann.port;
        var socket = zmq.socket('dealer');
        socket.identity = self.generateID();
        socket.connect(port);
        socket.on('message', function(msg) {
          self.dispatch(msg);
        });
        self.socket = socket;
        resolve(socket);
      });

      return promise;
    }
  };

  buildAPIs(serviceProto, serviceAnnouncement.api);
  buildRoutes(serviceProto, serviceAnnouncement.route);

  return Service.extend(serviceProto);
};


/**
 * Private helper functions
 */

function buildAPIs(proto, apis) {
  Object.keys(apis).forEach(function(apiName) {
    proto[apiName] = makeHandler(apiName);
  });
}

function buildRoutes(proto, routes) {
  var _routes = {};
  Object.keys(routes).forEach(function(routeName) {
    var handler = makeHandler(routeName);
    _routes[routeName] = handler;
    routes[routeName].handler = handler;
  });
  proto.routes = _routes;
}

function makeHandler(name) {
  return function() {
    var args = toArray(arguments);
    var data = {
      name: name,
      args: args
    };
    this.send(data);
  };
}
