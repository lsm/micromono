/**
 * Farcaster is the module for rebuilding a remote service into a local accessible
 * service class.
 */

/**
 * Module dependencies.
 */
var zmq = require('zmq');
var path = require('path');
var Router = require('./router');
var Service = require('./service');
var toArray = require('lodash.toarray');
var shortid = require('shortid');
var httpProxy = require('http-proxy');


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
      this.baseUrl = this.announcement.baseUrl;
      this.callbacks = {};

      if (this.routes) {
        this.router = new Router(this);
      }
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

    getProxyHandler: function(ann, baseUrl) {
      ann = ann || this.announcement;
      if (!ann.client && !ann.route) {
        return false;
      }

      var proxy = httpProxy.createProxyServer();
      var remoteServerUrl = 'http://' + ann.address + ':' + ann.webPort;

      if (baseUrl) {
        remoteServerUrl += baseUrl;
      }

      return function(req, res) {
        proxy.web(req, res, {
          target: remoteServerUrl
        });
      };
    },

    express: function(app) {
      var clientInfo = this.announcement.client;
      if (clientInfo) {
        // proxy requests for static asset
        var proxyHandler = this.getProxyHandler();
        var assetPath = path.join(clientInfo.publicURL, clientInfo.name, '*');
        app.get(assetPath, proxyHandler);
      }

      if (this.router) {
        var subApp = this.router.getExpressApp();
        this.app = subApp;
        app.use(this.baseUrl || '/', subApp);
      }
    },

    run: function(app) {
      var self = this;
      var ann = this.announcement;

      if (app) {
        this.express(app);
      }

      var promise = new Promise(function(resolve, reject) {
        var port = 'tcp://' + ann.address + ':' + ann.port;
        var socket = zmq.socket('dealer');
        socket.identity = self.generateID();
        socket.connect(port);
        socket.on('message', function(msg) {
          self.dispatch(msg);
        });
        self.socket = socket;
        resolve();
      });

      return promise;
    }
  };

  buildAPIs(serviceProto, serviceAnnouncement.api);
  buildRoutes(serviceProto, serviceAnnouncement);

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

function buildRoutes(proto, ann) {
  var route = ann.route;
  if (!route) {
    return;
  }

  var _routes = {};
  var proxyHandler = proto.getProxyHandler(ann, ann.baseUrl);

  Object.keys(route).forEach(function(routeName) {
    _routes[routeName] = proxyHandler;
    route[routeName].handler = proxyHandler;
  });
  proto.routes = _routes;
}
