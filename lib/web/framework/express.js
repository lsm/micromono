var path = require('path')
var jDad = require('jdad')
var debug = require('debug')('micromono:web:framework:express')
var express = require('express')
var difference = require('lodash.difference')
var isPlainObject = require('lodash.isplainobject')

/**
 * ExpressAdapter constructor
 */
var ExpressAdapter = module.exports = function() {
  this.app = express()
  this.mapp = express()
  this.aapp = express()
}

ExpressAdapter.prototype.type = 'express'

ExpressAdapter.prototype.startHttpServer = function(port, host, serviceName, callback) {
  debug('[%s] starting http server at %s:%s', serviceName, host, port)
  // Attach internal asset app
  this.app.use(this.aapp)
  // Attach internal middleware app
  this.app.use(this.mapp)
  // Create and listen http requests
  var server = this.app.listen(port, host, function() {
    var address = server.address()
    debug('[%s] http server started at %s:%s', serviceName, address.address, address.port)
    callback({
      httpHost: address.address,
      httpPort: address.port,
      httpServer: server
    })
  })
}

ExpressAdapter.prototype.attachHttpServer = function(httpServer, setHttpRequestHandler) {
  // Attach internal asset app
  this.app.use(this.aapp)
  // Attach internal middleware app
  this.app.use(this.mapp)
  setHttpRequestHandler(this.app)
}

ExpressAdapter.prototype.proxyWebsocket = function(upgradeUrl, wsProxyHandler) {
  upgradeUrl = path.join('/', upgradeUrl, '*')
  this.app.get(upgradeUrl, wsProxyHandler)
  this.app.post(upgradeUrl, wsProxyHandler)
}

/**
 * Attach a single route to express app.
 *
 * @param  {Object} route     The route definition object which has following format:
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
 * @param  {Router}   router  The instance of Router.
 * @param  {Service}  service The service instance.
 * @return {ExpressAdapter}   The instance of this adpater.
 */
ExpressAdapter.prototype.attachRoutes = function(routes, service) {
  var app = this.app

  Object.keys(routes).forEach(function(routeName) {
    var route = routes[routeName]
    var method = route.method.toLowerCase()
    var routePath = route.path

    if ('param' === method)
      routePath = route.name.split('::')[1]
    debug('[%s] attach route handler: "%s %s"', service.name, method, routePath)

    var handler = route.handler.bind(service)

    var middlewares = []
    if (Array.isArray(route.middleware)) {
      // Only allow functions
      route.middleware.forEach(function(m) {
        if ('function' === typeof m)
          middlewares.push(m.bind(service))
      })
    }

    if (middlewares.length > 0)
      app[method](routePath, middlewares, handler)
    else
      app[method](routePath, handler)
  })

  return this
}

/**
 * Serve the static asset files accroding to service settings.
 *
 * @param  {Asset}    asset     The instance of asset.
 * @param  {Router}   [router]  The instance of Router.
 * @param  {Service}  [service] The service instance.
 * @return {ExpressAdapter}   The instance of this adpater.
 */
ExpressAdapter.prototype.serveLocalAsset = function(publicURL, publicPath, serviceName) {
  var assetApp = this.aapp

  if (!publicURL)
    throw new Error('Asset has no publicURL configured.')

  if (!publicPath)
    throw new Error('Asset has no publicPath configured.')

  publicURL.forEach(function(url) {
    debug('[%s] serve static files from "%s" for url "%s"', serviceName, publicPath, url)
    assetApp.use(url, express.static(publicPath))
  })

  return this
}

ExpressAdapter.prototype.proxyAsset = function(assetInfo, proxyHandler, serviceName) {
  var assetApp = this.aapp
  var publicURL = assetInfo.publicURL

  publicURL.forEach(function(url) {
    debug('[%s] proxy static asset to url "%s"', serviceName, url)
    var assetUrl = path.join(url, '*')
    assetApp.get(assetUrl, proxyHandler)
  })
}

ExpressAdapter.prototype.injectAssetInfo = function(assetInfo) {
  this.app.use(function(req, res, next) {
    res.locals.asset = assetInfo
    next()
  })
}

/**
 * Use a middleware directly with framework without any modifications.
 *
 * @param  {String} url       The url which the middleware will be applied to.
 * @param  {Any} middleware   The middleware object accepts by the framework.
 * @return {ExpressAdapter}   The instance of this adpater.
 */
ExpressAdapter.prototype.useMiddleware = function(url, middleware, routes, service) {
  if (!Array.isArray(url))
    url = [url]

  var app = this.app
  var _middleware = middleware(app)

  url.forEach(function(link) {
    var method = link.method
    var mounted = false

    if ('default' === method && routes) {
      Object.keys(routes).forEach(function(routeName) {
        var _route = routes[routeName]
        // It's a router based middleware if we have exactly same url defined in route
        if (_route.path === link.path) {
          debug('[%s] attach "%s" router middleware directly at path "%s"', service.name, _route.method, link.path)
          app[_route.method](link.path, _middleware)
          mounted = true
        }
      })
    }

    if (false === mounted) {
      method = 'default' === method ? 'use' : method
      debug('[%s] use middleware directly at path "%s" with method "%s"', service.name, link.path, method)
      app[method](link.path, _middleware)
    }
  })
}

/**
 * Attach a single middleware to express app.
 *
 * @param  {Object} middleware The middleware definition object which has following format:
 *
 * ```javascript
 * {
 *   // the name of the middleware
 *   name: 'auth',
 *   // relative path to the middleware
 *   path: '/account/middleware/auth',
 *   // the function for generating handler function
 *   handler: function() {
 *     ...
 *     return function(req, res, next) {...}
 *   }
 * }
 *
 * ```
 *
 * @param  {Router}   router  The instance of Router.
 * @param  {Service}  service The service instance.
 * @return {ExpressAdapter}   The instance of this adpater.
 */


ExpressAdapter.prototype.attachLocalMiddlewares = function(middlewares, service) {
  var self = this
  Object.keys(middlewares).forEach(function(mName) {
    var middleware = middlewares[mName]
    //
    self._attachLocalMiddleware(middleware, service)
  })
}

// Private function for attaching local middlewares
ExpressAdapter.prototype._attachLocalMiddleware = function(middleware, service) {
  var app = this.mapp

  // @todo support middleware options
  middleware.handler = middleware.handler.bind(service)
  var handlerFn = middleware.handler()

  debug('[%s] attach local middleware "%s" at "%s"', service.name, middleware.name, middleware.path)
  app.use(middleware.path, function(req, res, next) {
    var semi = true

    // find out if the middleware wants to alter response
    var _writeHead = req.writeHead
    var _write = req.write
    var _end = req.end

    // record changes of `req` and `req.headers`
    var reqKeys = Object.keys(req)
    var headerKeys = Object.keys(req.headers)

    handlerFn(req, res, function(err) {
      semi = _writeHead === req.writeHead && _write === req.write && _end === req.end

      if (err) {
        debug('Middleware error', err)
        res.writeHead(500, 'MicroMono middleware error.')
        res.end()
        return
      }

      if (semi) {
        // using a non-exists status code to indicate that the middleware
        // does not need to change the response
        res.statusCode = 103

        // we only care about properties which have been added to the `req`
        // object
        var changedReqKeys = difference(Object.keys(req), reqKeys)
        var changedHeaderKeys = difference(Object.keys(req.headers), headerKeys)

        var _req = {}
        var _headers = {}

        // Only allow value type `string`, `array` and `plain object`. 
        // But, properties or members of object and array are not checked.
        // This should be able to handle most of the cases. 
        changedReqKeys.forEach(function(key) {
          var value = req[key]
          if ('string' === typeof value || Array.isArray(value) || isPlainObject(value))
            _req[key] = value
        })

        changedHeaderKeys.forEach(function(key) {
          _headers[key] = req.headers[key]
        })

        if (Object.keys(_headers).length > 0)
          _req.headers = _headers

        if (Object.keys(_req).length > 0) {
          res.setHeader('X-MicroMono-Req', jDad.stringify(_req, {
            cycle: true
          }))
        }

        res.end()
      } else {
        // let the request go if this is a fully-remote middleware
        next()
      }
    })
  })
}
