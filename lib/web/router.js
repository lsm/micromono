var path = require('path')
var http = require('http')
var jDad = require('jdad')
var merge = require('lodash.merge')
var debug = require('debug')('micromono:router')
var assign = require('lodash.assign')
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

exports.normalizeMiddlewares = function(middleware, middlewareBaseUrl) {
  var _middlewares = {}

  Object.keys(middleware).forEach(function(name) {
    _middlewares[name] = {
      name: name,
      path: path.join(middlewareBaseUrl, name),
      handler: middleware[name]
    }
  })

  return _middlewares
}

// Static function for processing remote middleware. It rebuilds the remote
// middleware handler so it could be used locally.
exports.rebuildRemoteMiddlewares = function(middlewares, service) {
  Object.keys(middlewares).forEach(function(mName) {
    var middleware = middlewares[mName]
    var _path = middleware.path
    debug('[%s] rebuild remote middleware handler "%s" url "%s"', service.name, middleware.name, _path)

    var handler = function() {
      return function(req, res, next) {
        var provider = service.scheduler.get()
        if (!provider) {
          exports.noProviderAvailable(req, res, next)
          return
        }

        var headers = assign({}, req.headers)
        delete headers['content-length']
        var proxyReq = http.request({
          host: provider.host,
          port: provider.web.port,
          path: _path,
          method: req.method,
          headers: headers
        }, function(proxyRes) {
          if (proxyRes.statusCode === 103) {
            var reqMerge = proxyRes.headers['x-micromono-req']
            if (reqMerge) {
              try {
                reqMerge = jDad.parse(reqMerge, {
                  decycle: true
                })
                merge(req, reqMerge)
              } catch (e) {
                debug('[%s] Failed to merge request from remote middleware', service.name, e)
              }
            }
            next()
          } else {
            res.set(proxyRes.headers)
            res.statusCode = proxyRes.statusCode
            proxyRes.pipe(res)
          }
        })

        proxyReq.on('error', function(err, req, res) {
          if (res) {
            res.writeHead(500, {
              'Content-Type': 'text/plain'
            })
            res.end('Service error')
          }
          debug('[%s] middleware "%s" proxy error', service.name, mName, err.stack)
        })

        proxyReq.end()
      }
    }

    service.middleware[middleware.name] = handler
  })
}

/**
 * Get a function which proxy the requests to the real services.
 *
 * @param  {String} baseUrl      The base url for the target endpoint of the service.
 * @param  {String} upgradeUrl   The url for upgrade request (websockets).
 * @param  {Object} httpServer
 * @return {Function}            The proxy handler function.
 */
exports.getProxyHandler = function(scheduler, httpServer, upgradeUrl) {

  function createProxy(provider, server, upgradeUrl) {
    var proxy = httpProxy.createProxyServer({
      target: {
        host: provider.web.host,
        port: provider.web.port
      }
    })

    if (server && upgradeUrl) {
      server.on('upgrade', function(req, socket, head) {
        debug('Proxy websocket %s %s to povider %s:%s from %s',
          req.method,
          req.url,
          provider.web.host,
          provider.web.port,
          socket.remoteAddress || req.hostname
        )
        proxy.ws(req, socket, head)
      })
    }

    proxy.on('error', function(err, req, res) {
      debug('Proxy error, request from %s target %s %s\n %s',
        res.remoteAddress || req.hostname,
        req.method,
        provider.web.host + ':' + provider.web.port + req.url,
        err.stack)

      if (/^Error: socket hang up/.test(err.stack)) {
        // Ignore socket hang up error.
        return
      }

      if (res && res.writeHead) {
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        })
        res.end('Service error')
      }
    })

    return proxy
  }

  return function(req, res) {
    var provider = scheduler.get()

    if (!provider) {
      exports.noProviderAvailable(req, res)
    } else {
      if (upgradeUrl) {
        req.url = path.join(upgradeUrl, req.url)
      }
      debug('Proxy web %s %s to povider %s:%s from %s',
        req.method,
        req.url,
        provider.web.host,
        provider.web.port,
        res.remoteAddress || req.hostname
      )
      if (!provider.proxy) {
        provider.proxy = createProxy(provider, httpServer, upgradeUrl)
      }
      // var target = 'http://' + provider.host + ':' + provider.web.port
      // if (upgradeUrl) {
      //   target += upgradeUrl[0] === '/' ? upgradeUrl : '/' + upgradeUrl
      // }
      provider.proxy.web(req, res)
    }
  }
}

exports.noProviderAvailable = function(req, res) {
  res.writeHead(503)
  res.end('Service Unavailable')
}
