var path = require('path')
var debug = require('debug')('micromono:router')
var isArray = require('lodash.isarray')
var argsNames = require('js-args-names')
var httpProxy = require('http-proxy')


/**
 * Create route definition object from route name.
 *
 * @param  {String}    routeName Path of the route
 * @return {Object}    Route definition object
 */
exports.generateRouteByName = function(routeName, defaultMethod) {
  if ('string' === typeof routeName) {
    var _path = routeName.split('::')
    var method = defaultMethod || 'get'
    if (_path.length === 2) {
      method = _path[0]
      _path = _path[1]
    } else {
      _path = routeName
    }

    var route = {
      name: routeName,
      method: method,
      path: _path
    }

    return route
  } else {
    throw new Error('Route name should be string.')
  }
}

/**
 * Normalize route definition to a portable format which could be easily used
 * by different web frameworks.
 *
 * ```javascript
 * route: {
 *   'get::/user/:name': function(req, res) {...}
 * }
 * ```
 *
 * will be formatted into:
 *
 * ```javascript
 * {
 *   name: 'get::/user/:name',
 *   method: 'get',
 *   path: '/user/:name',
 *   handler: [Function],
 *   args: ['req', 'res'],
 *   middleware: null
 * }
 * ```
 *
 * Example with route middleware:
 *
 * ```javascript
 * route: {
 *   'get::/user/:name': [function(req, res, next) {...}, function(req, res) {...}]
 * }
 * ```
 *
 * will be formatted into:
 *
 * ```javascript
 * {
 *   name: 'get::/user/:name',
 *   method: 'get',
 *   path: '/user/:name',
 *   handler: Function,
 *   args: ['req', 'res'],
 *   middleware: [Function]
 * }
 * ```
 *
 * @param {Object}  route   Route definition object.
 * @param {Service} service Instance of service.
 * @return {Object}         Formatted routes object.
 */
exports.normalizeRoutes = function(route, page, pageApiBaseUrl) {
  var _routes = {}

  Object.keys(route).forEach(function(routePath) {
    var middleware
    var routeHandler = route[routePath]
    var _route = exports.generateRouteByName(routePath)

    if (page && page.hasOwnProperty(routePath)) {
      _route.page = page[routePath]
    }

    if (isArray(routeHandler)) {
      middleware = routeHandler
      routeHandler = middleware.pop()
    }

    _route.args = argsNames(routeHandler)
    _route.handler = routeHandler
    _route.middleware = middleware || null

    if (_route.page) {
      // Add the page api route
      var apiRoutePath = path.join(pageApiBaseUrl, _route.path)
      if (!_routes[apiRoutePath]) {
        _route.api = apiRoutePath
        _routes[apiRoutePath] = {
          name: apiRoutePath,
          method: _route.method,
          path: apiRoutePath,
          args: _route.args,
          handler: _route.handler,
          middleware: _route.middleware
        }
      }
    }

    _routes[routePath] = _route
  })

  return _routes
}

exports.normalizeUses = function(use) {
  var _uses = {}

  Object.keys(use).forEach(function(name) {
    var _use = use[name]
    if (!Array.isArray(_use)) {
      _use = [_use]
    }
    _use = _use.map(function(url) {
      if ('string' === typeof url) {
        url = exports.generateRouteByName(url, 'default')
      }
      return url
    })
    _uses[name] = _use
  })

  return _uses
}

exports.normalizeMiddlewares = function(middleware, middlewarePrefix) {
  var _middlewares = {}

  Object.keys(middleware).forEach(function(name) {
    _middlewares[name] = {
      name: name,
      path: path.join(middlewarePrefix, name),
      handler: middleware[name]
    }
  })

  return _middlewares
}

/**
 * Get a function which proxy the requests to the real services.
 *
 * @param  {String} baseUrl      The base url for the target endpoint of the service.
 * @param  {String} allowUpgrade The url for upgrade request (websockets).
 * @return {Function}            The proxy handler function.
 */
exports.getProxyHandler = function(webServer, allowUpgrade) {
  var proxy = httpProxy.createProxyServer()

  proxy.on('error', function(err, req, res) {
    if (res) {
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      })
      res.end('Service error')
    }
    debug('Proxy error', err.stack)
  })

  var service = this.service
  var scheduler = service.scheduler

  if (allowUpgrade) {
    webServer.on('upgrade', function(req, socket, head) {
      var provider = scheduler.get()
      if (!provider) {
        exports.noProviderAvailable(req, socket)
      } else {
        var target = 'http://' + provider.address + ':' + provider.webPort
        proxy.ws(req, socket, head, {
          target: target
        })
      }
    })
  }

  return function(req, res) {
    var provider = scheduler.get()
    if (!provider) {
      exports.noProviderAvailable(req, res)
    } else {
      var target = 'http://' + provider.address + ':' + provider.webPort
      proxy.web(req, res, {
        target: target
      })
    }
  }
}

exports.noProviderAvailable = function(req, res) {
  res.writeHead(500)
  res.end('Service Unavailable')
}
