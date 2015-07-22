var path = require('path');
var isArray = require('lodash.isarray');
var express = require('express');
var getFnArgs = require('./helper').getFnArgs;
var httpProxy = require('http-proxy');
var difference = require('lodash.difference');


var Router = module.exports = function MicroMonoRouter(service) {
  this.service = service;
  var ann = service.announcement;

  if (ann.route || service.routes || service.middleware) {
    this.routeApp = express();
  }

  if (ann.client) {
    this.assetApp = express();
  }
};

Router.prototype = {

  getRoutes: function() {
    if (!this.routes) {
      this.routes = this.buildRoutes();
    }
    return this.routes;
  },

  getMiddlewares: function() {
    if (!this.middlewares) {
      this.middlewares = this.buildMiddlewares();
    }
    return this.middlewares;
  },

  getProxyHandler: function(baseUrl) {
    var proxy = httpProxy.createProxyServer();

    proxy.on('error', function(err, req, res) {
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      });

      res.end('Proxy error');
    });

    return function(req, res) {
      var connector = this.connector;
      var address = connector.fetchProxyAddress();
      var remoteServerUrl = 'http://' + address.host + ':' + address.port;

      if (baseUrl) {
        remoteServerUrl += baseUrl;
      }

      proxy.web(req, res, {
        target: remoteServerUrl
      });

      connector.returnProxyAddress(address);
    };
  },

  buildRoutes: function() {
    var _routes = {};
    var proxyHandler;
    var service = this.service;
    var ann = service.announcement;
    var isRemote = service.isRemote();

    // setup route for static asset files
    if (ann.client) {
      var assetApp = this.assetApp;
      var clientInfo = ann.client;

      if (isRemote) {
        // proxy requests for static asset
        var assetHandler = this.getProxyHandler();
        var assetPath = path.join(clientInfo.publicURL, clientInfo.name, '*');
        assetApp.get(assetPath, assetHandler.bind(this));
      } else {
        assetApp.use(service.asset.publicURL, express.static(service.asset.publicPath));
      }
    }

    if (!this.routeApp) {
      return _routes;
    }

    var routeApp = this.routeApp;
    var routes = isRemote ? ann.route : service.routes;

    if (isRemote) {
      proxyHandler = this.getProxyHandler(ann.baseUrl);
    }

    routes && Object.keys(routes).forEach(function(routePath) {
      var _route;
      if (isRemote) {
        // remote service
        var routeInfo = routes[routePath];
        _route = {
          name: routePath,
          method: routeInfo.method,
          path: routeInfo.path,
          handler: proxyHandler,
          args: routeInfo.args
        };
      } else {
        _route = _formatRoutePath(routePath);
        var routeHandler = routes[routePath];
        var middleware;

        if (isArray(routeHandler)) {
          middleware = routeHandler;
          routeHandler = middleware.pop();
        }

        if (typeof routeHandler === 'string') {
          routeHandler = service[routeHandler];
        }

        if (typeof routeHandler !== 'function') {
          throw new Error('Route handler for path ' + routePath + ' is not a function.');
        }

        var args = getFnArgs(routeHandler);
        if (middleware) {
          _route.middleware = middleware;
        }
        _route.handler = routeHandler;
        _route.args = args;
      }

      _routes[routePath] = _route;
      if (_route.middleware) {
        routeApp[_route.method](_route.path, _route.middleware.map(function(m) {
          return m.bind(service);
        }), _route.handler.bind(service));
      } else {
        routeApp[_route.method](_route.path, _route.handler.bind(service));
      }
    });

    return _routes;
  },

  buildMiddlewares: function() {
    var service = this.service;
    if (!service.isRemote() && service.middleware) {
      var middleware = service.middleware;
      var routeApp = this.routeApp;
      var middlewares = {};
      Object.keys(middleware).forEach(function(name) {
        var _path = '/middleware/' + name;
        _path = path.join(service.baseUrl, _path);
        middlewares[name] = {
          name: name,
          path: _path
        };

        // @todo support middleware options
        var middlewareFn = middleware[name]();
        routeApp.all(_path, function(req, res, next) {
          var semi = true;

          // find out if the middleware wants to alter response
          Object.observe(res, function(changes) {
            changes.forEach(function(change) {
              semi = ['writeHead', 'write', 'end'].indexOf(change.name) === -1;
            });
          });

          // record changes of `req` and `req.headers`
          var reqKeys = Object.keys(req);
          var headerKeys = Object.keys(req.headers);

          middlewareFn(req, res, function(err) {
            if (err) {
              res.writeHead(500, 'MicroMono middleware error.');
              res.end();
              return;
            }

            if (semi) {
              // using a non-exists status code to indicate that the middleware
              // does not need to change the response
              res.statusCode = 103;

              // we only care about properties which have been added to the `req`
              // object
              var changedReqKeys = difference(Object.keys(req), reqKeys);
              var changedHeaderKeys = difference(Object.keys(req.headers), headerKeys);

              var _req = {};
              var _headers = {};

              changedReqKeys.forEach(function(key) {
                if (key !== 'read') { // @todo add more ignored names here
                  _req[key] = req[key];
                }
              });

              changedHeaderKeys.forEach(function(key) {
                _headers[key] = req.headers[key];
              });

              if (Object.keys(_headers).length > 0) {
                _req.headers = _headers;
              }

              if (Object.keys(_req).length > 0) {
                res.setHeader('X-MicroMono-Req', JSON.stringify(_req));
              }

              res.end();
            } else {
              // let the request go if this is a fully-remote middleware
              next();
            }
          });
        });
      });
      return middlewares;
    }
  }
};

/**
 * MicroMonoRouter private functions.
 */

/**
 * [formatRoutePath description]
 * @param  {[type]} routePath [description]
 * @return {Object}           Route definition object
 */
function _formatRoutePath(routePath) {
  var _route = {};
  if (typeof routePath === 'string') {
    var _path = routePath.split('::');
    var method = 'get';
    if (_path.length === 2) {
      method = _path[0];
      _path = _path[1];
    } else {
      _path = routePath;
    }
    _route = {
      name: routePath,
      method: method,
      path: _path
    };
  }
  return _route;
}
