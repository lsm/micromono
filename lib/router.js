var express = require('express');
var getFnArgs = require('./helper').getFnArgs;


var Router = module.exports = function(service) {
  var routerApp = express();
  this.routes = this.getRoutes(service, function(route) {
    routerApp[route.method](route.path, route.handler.bind(service));
  });
  this.service = service;
  this.expressRouterApp = routerApp;
};

Router.prototype = {

  /**
   * Get the routes definition object
   * @param  {[type]}   service  [description]
   * @param  {Function} callback [description]
   * @return {[type]}            [description]
   */
  getRoutes: function(service, callback) {
    var routes = this.routes || _getRoutes(service, callback);
    return routes;
  },

  express: function(app, baseUrl) {
    app.use(baseUrl || '/', this.expressRouterApp);
  }
};

/**
 * MicroMonoService private functions.
 */

/**
 * Take a service instance and generate the routes info.
 *
 * @param  {Service} service Instance of MicroMonoService.
 * @return {Object}         Array of routes information in following format:
 *     {
 *       'get::/hello/:name': {
 *         name: 'get::/hello/:name',
 *         method: 'get',
 *         path: '/hello:/:name',
 *         args: ['name', 'callback'],
 *         handler: function (name, callback) {
 *           // function body
 *           ...
 *         }
 *       },
 *       // more routes
 *       ...
 *     }
 */
function _getRoutes(service, callback) {
  var routes = service.routes;
  if (!routes || Object.keys(routes).length < 1) {
    return;
  }

  var _routes = {};

  Object.keys(routes).forEach(function(routePath) {
    var _route = _formatRoutePath(routePath);
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

    _routes[routePath] = _route;
    callback && callback(_route);
  });

  return _routes;
}

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
