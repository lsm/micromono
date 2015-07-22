/**
 * Farcaster is the module for rebuilding a remote service into a local accessible
 * service class.
 */

/**
 * Module dependencies.
 */

var http = require('http');
var merge = require('lodash.merge');
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
      var ann = this.announcement = serviceAnnouncement;
      this.baseUrl = this.announcement.baseUrl;
      this.callbacks = {};

      if (ann.route || ann.client || ann.middleware) {
        this.router = new Router(this);
      }

      if (ann.middleware) {
        buildMiddlewares(this, ann.middleware);
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

      if (this.router) {
        // load route handlers
        this.router.getRoutes();
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
  if (apis) {
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
}

function buildMiddlewares(service, middlewares) {
  if (middlewares) {
    var middleware = {};

    Object.keys(middlewares).forEach(function(name) {
      var _path = middlewares[name].path;

      middleware[name] = function() {
        // @todo support remote middleware options

        return function(req, res, next) {
          var connector = service.connector;
          var address = connector.fetchProxyAddress();

          // @todo this is a naive proxy implementation.
          var proxyReq = http.request({
            host: address.host,
            port: address.port,
            path: _path,
            headers: req.headers
          }, function(proxyRes) {
            if (proxyRes.statusCode === 103) {
              var reqMerge = proxyRes.headers['x-micromono-req'];
              if (reqMerge) {
                try {
                  reqMerge = JSON.parse(reqMerge);
                  merge(req, reqMerge);
                } catch (e) {}
              }
              next();
            } else {
              res.set(proxyRes.headers);
              res.statusCode = proxyRes.statusCode;
              proxyRes.pipe(res);
            }
          });

          proxyReq.on('error', function(err, req, res) {
            res.writeHead(500, {
              'Content-Type': 'text/plain'
            });

            res.end('Proxy error');
          });

          req.pipe(proxyReq);

          connector.returnProxyAddress(address);
        };
      };
    });

    service.middleware = middleware;
  }
}
