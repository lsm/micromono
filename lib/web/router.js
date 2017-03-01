var path = require('path')
var http = require('http')
var jDad = require('jdad')
var merge = require('lodash.merge')
var logger = require('../logger')('micromono:web:router')
var assign = require('lodash.assign')
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
    var route = {
      name: routeName
    }

    if (2 === _path.length) {
      method = _path[0]
      _path = _path[1]
    } else if (3 === _path.length) {
      // This is GET route with page definition in format of:
      // `[method]::[routeUrl]::[templatePath]`
      // `get::/abc::public/abc.jsx!`
      method = _path[0]
      route.page = _path[2]
      _path = _path[1]
    } else {
      _path = routeName
    }

    route.path = _path
    route.method = method

    return route
  } else {
    logger.fatal('Route name must be a string.', {
      routeName: routeName
    })
    process.exit(1)
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

    // Page contains mapping between url and template for client side routing
    // and rendering. e.g.:
    //
    // {`/abc`: 'public/abc.mustache'}
    //
    // The above tells url `/abc` uses template `public/abc.mustache` for client
    // side rendering.
    //
    if (page && page.hasOwnProperty(routePath))
      _route.page = page[routePath]
    if (Array.isArray(routeHandler)) {
      middleware = routeHandler
      routeHandler = middleware.pop()
    }

    _route.args = argsNames(routeHandler)
    _route.handler = routeHandler
    _route.middleware = middleware || null

    if (_route.page) {
      // Add the page api route
      var apiRoutePath = path.join(pageApiBaseUrl, _route.path)

      if (apiRoutePath.length > 1 && '/' === apiRoutePath[apiRoutePath.length - 1])
        apiRoutePath = apiRoutePath.slice(0, -1)

      if (!_routes[apiRoutePath]) {
        _route.api = apiRoutePath
        _routes[apiRoutePath] = {
          name: apiRoutePath,
          path: apiRoutePath,
          args: _route.args,
          method: _route.method,
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
    if (!Array.isArray(_use))
      _use = [_use]

    _use = _use.map(function(url) {
      if ('string' === typeof url)
        url = exports.generateRouteByName(url, 'default')
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

    logger.debug('Rebuild remote middleware handler', {
      path: _path,
      service: service.name,
      middleware: middleware.name
    })

    var handler = function() {
      return function(req, res, next) {
        var provider = service.scheduler.get()
        if (!provider) {
          exports.noProviderAvailable(req, res, next)
          return
        }

        var headers = assign({}, req.headers)
        delete headers['content-length']
        delete headers['x-micromono-req']
        var proxyReq = http.request({
          host: provider.host,
          port: provider.web.port,
          path: _path,
          method: req.method,
          headers: headers
        }, function(proxyRes) {
          if (103 === proxyRes.statusCode) {
            var reqMerge = proxyRes.headers['x-micromono-req']
            if (reqMerge) {
              try {
                reqMerge = jDad.parse(reqMerge, {
                  decycle: true
                })
                merge(req, reqMerge)
              } catch (e) {
                logger.warn('Failed to merge request from remote middleware', {
                  error: e,
                  service: service.name
                })
              }
            }
            next()
          } else {
            if (res.set) {
              res.set(proxyRes.headers)
            } else {
              res.headers = res.headers || {}
              assign(res.headers, proxyRes.headers)
            }
            res.statusCode = proxyRes.statusCode
            proxyRes.pipe(res)
          }
        })

        proxyReq.on('error', function(err, req, res) {
          if (res) {
            res.writeHead && res.writeHead(500, {
              'Content-Type': 'text/plain'
            })
            res.end && res.end('Service error')
          }
          logger.debug('Middleware "%s" proxy error', {
            error: err.stack,
            service: service.name,
            middleware: mName
          })
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
  var proxy = httpProxy.createProxyServer({})

  if (httpServer && upgradeUrl) {
    var re = new RegExp('^' + upgradeUrl)
    httpServer.on('upgrade', function(req, socket, head) {
      if (re.test(req.url)) {
        var provider = scheduler.get()
        if (!provider) {
          exports.noProviderAvailable(req, socket)
        } else {
          var target = 'http://' + provider.host + ':' + provider.web.port
          proxy.ws(req, socket, head, {
            target: target
          })
        }
      }
    })
  }

  proxy.on('error', function(err, req, res) {
    logger.debug('Proxy error', {
      error: err.stack,
      method: req.method,
      remoteAddress: res && res.remoteAddress || req.hostname
    })

    if (/^Error: socket hang up/.test(err.stack))
      // Ignore socket hang up error.
      return

    if (res && res.writeHead) {
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      })
      res.end('Service error')
    }
  })

  return function(req, res) {
    var provider = scheduler.get()
    if (!provider) {
      exports.noProviderAvailable(req, res)
    } else {
      var target = 'http://' + provider.host + ':' + provider.web.port
      if (upgradeUrl)
        target += '/' === upgradeUrl[0] ? upgradeUrl : '/' + upgradeUrl

      proxy.web(req, res, {
        target: target
      })
    }
  }
}

exports.noProviderAvailable = function(req, res) {
  res.writeHead && res.writeHead(503)
  res.end && res.end('Service Unavailable')
}
