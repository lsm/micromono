var path = require('path');
var express = require('express');
var getFnArgs = require('./helper').getFnArgs;
var httpProxy = require('http-proxy');


var Router = module.exports = function MicroMonoRouter(service) {
  this.service = service;
  var ann = service.announcement;

  if (ann.route || service.routes) {
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

    Object.keys(routes).forEach(function(routePath) {
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

        if (typeof routeHandler === 'string') {
          routeHandler = service[routeHandler];
        }

        if (typeof routeHandler !== 'function') {
          throw new Error('Route handler for path ' + routePath + ' is not a function.');
        }

        var args = getFnArgs(routeHandler);
        _route.handler = routeHandler;
        _route.args = args;
      }

      _routes[routePath] = _route;
      routeApp[_route.method](_route.path, _route.handler.bind(service));
    });

    return _routes;
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
