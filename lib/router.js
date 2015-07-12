var path = require('path');
var express = require('express');
var getFnArgs = require('./helper').getFnArgs;
var httpProxy = require('http-proxy');


var Router = module.exports = function MicroMonoRouter(service) {
  this.service = service;
  this.routes = this.buildRoutes();
};

Router.prototype = {

  getRoutes: function() {
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
    var routes = isRemote ? ann.route : service.routes;

    if (!routes || Object.keys(routes).length === 0) {
      return _routes;
    }

    var routeApp = express();
    this.routeApp = routeApp;

    if (isRemote) {
      proxyHandler = this.getProxyHandler(ann.baseUrl);
    }

    // setup route for static asset files
    if (ann.client) {
      var assetApp = express();
      var clientInfo = ann.client;

      if (isRemote) {
        // proxy requests for static asset
        var assetHandler = this.getProxyHandler();
        var assetPath = path.join(clientInfo.publicURL, clientInfo.name, '*');
        assetApp.get(assetPath, assetHandler.bind(this));
      } else {
        assetApp.use(service.asset.publicURL, express.static(service.asset.publicPath));
      }

      this.assetApp = assetApp;
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
 * MicroMonoService private functions.
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
