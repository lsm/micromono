/**
 * Farcaster is the module for rebuilding a remote service into a local accessible
 * service class.
 */

/**
 * Module dependencies.
 */

var http = require('http');
var merge = require('lodash.merge');
var debug = require('debug')('micromono:service');
var assign = require('lodash.assign');
var Router = require('./router');
var Service = require('./service');
var toArray = require('lodash.toarray');
var shortid = require('shortid');


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
      this.providers = [];

      if (ann.api && ann.rpcPort && ann.rpcType) {
        var rpcClient = require('./rpc/' + ann.rpcType).client;
        assign(this, rpcClient);
      }

      if (ann.route || ann.client || ann.middleware) {
        this.router = new Router(this);
      }

      buildMiddlewares(this, ann.middleware);
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
      if (this.hasProvider(ann)) {
        return;
      }

      debug('new provider for service `%s` found at %s', ann.name, ann.address);

      if (ann.api && ann.rpcPort) {
        this.connect(ann);
      }

      this.providers.push(ann);
    },

    hasProvider: function(ann) {
      var found = this.providers.some(function(provider) {
        if (ann.address && provider.address === ann.address) {
          if (ann.rpcPort && provider.rpcPort === ann.rpcPort) {
            return true;
          }
          if (ann.webPort && provider.webPort === ann.webPort) {
            return true;
          }
          if (ann.middlewarePort && provider.middlewarePort === ann.middlewarePort) {
            return true;
          }
        }
      });
      return found;
    },

    scheduleProvider: function(callback) {
      var provider = this.providers.shift();
      callback(provider);
      this.providers.push(provider);
    },

    onProviderDisconnect: function(provider) {
      var idx = this.providers.indexOf(provider);
      if (idx > -1) {
        delete this.providers[idx];
      }
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
          service.scheduleProvider(function(provider) {
            // @todo this is a naive proxy implementation.
            var proxyReq = http.request({
              host: provider.address,
              port: provider.webPort,
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
          });
        };
      };
    });

    service.middleware = middleware;
  }
}
