var path = require('path')
var http = require('http')
var jDad = require('jdad')
var merge = require('lodash.merge')
var debug = require('debug')('micromono:web:framework:express')
var assign = require('lodash.assign')
var express = require('express')
var Router = require('../router')
var difference = require('lodash.difference')

/**
 * ExpressAdapter constructor
 */
var ExpressAdapter = module.exports = function() {
  this.app = express()
  this.mapp = express()
  this.aapp = express()
}

ExpressAdapter.prototype.type = 'express'

/**
 * Get the instance of express app.
 *
 * @return {Express} A instance of express app
 */
ExpressAdapter.prototype.getApp = function() {
  return this.app
}

ExpressAdapter.prototype.setApp = function(app) {
  this.app = app
}

function mountToMainApp(mainApp) {
  // Attach internal asset app
  mainApp.use(this.aapp)

  // Attach internal middleware app
  mainApp.use(this.mapp)

  // Attach our `app` to the main express app unless they are the same instance.
  if (mainApp !== this.app) {
    mainApp.use(this.app)
  }
}

ExpressAdapter.prototype.startHttpServer = function(port, host, serviceName) {
  var mainApp = express()
  mountToMainApp.call(this, mainApp)

  var promise = new Promise(function(resolve) {
    // We created the main app by ourselves so we should listen it
    debug('[%s] listen to http requests at "%s:%s"', serviceName, host, port)
    var server = mainApp.listen(port, host)
    resolve(server)
  })

  return promise
}

ExpressAdapter.prototype.startServer = function(port, host, serviceName) {
  var mainApp
  var app = this.getApp()

  if ('function' === typeof port) {
    debug('[%s] port is the main express app', serviceName)
    // Port is an express app
    this.mainApp = port
  }

  if (!this.mainApp) {
    mainApp = express()
    this.mainApp = mainApp
  }

  // Attach internal asset app
  this.mainApp.use(this.aapp)

  // Attach internal middleware app
  this.mainApp.use(this.mapp)

  // Attach our `app` to the main express app unless they are the same instance.
  if (this.mainApp !== app) {
    this.mainApp.use(app)
  }

  var self = this
  var promise = new Promise(function(resolve) {
    if (mainApp) {
      // We created the main app by ourselves so we should listen it
      debug('[%s] listen to http requests at "%s:%s"', serviceName, host, port)
      var server = mainApp.listen(port, host)
      resolve(server)
    } else {
      // Not a service which means it's a balancer
      debug('[%s] binding http port should be handled externally', serviceName)
      // Let's get the server object
      mainApp = self.mainApp
      var _listen = mainApp.listen
      mainApp.listen = function(port, host) {
        debug('[%s] listen to requests at port %s host %s', port, host)
        var server = _listen.apply(mainApp, arguments)
        resolve(server)
        return server
      }
    }
  })

  return promise
}

/**
 * Allow upgraded requests proxy to the backend services. It will only be called
 * when micromono runs in the balancer mode.
 *
 * @param  {String} url   The url which allows upgraded requests
 * @param {Function}     The handler function which takes
 *                        `req` (http.IncomingMessage) and
 *                        `res` (http.ServerResponse) as
 *                        arguments and do the actual proxy.
 * @param  {Router}   router  The instance of Router.
 * @param  {Service}  service The service instance.
 * @return {ExpressAdapter}   The instance of this adpater.
 */
ExpressAdapter.prototype.allowUpgrade = function(url, handler, router, service) {
  this.app.use(url, handler)
  return this
}

ExpressAdapter.prototype.proxyWebsocket = function(upgradeUrl, wsProxyHandler) {
  this.app.use(upgradeUrl, wsProxyHandler)
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

    if ('param' === method) {
      routePath = route.name.split('::')[1]
    }

    debug('[%s] attach route handler: "%s %s"', service.name, method, routePath)

    var handler = route.handler.bind(service)

    var middlewares = []
    if (Array.isArray(route.middleware)) {
      // Only allow functions
      route.middleware.forEach(function(m) {
        if ('function' === typeof m) {
          middlewares.push(m.bind(service))
        }
      })
    }

    if (middlewares.length > 0) {
      app[method](routePath, middlewares, handler)
    } else {
      app[method](routePath, handler)
    }
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
ExpressAdapter.prototype.serveLocalAsset = function(asset, serviceName) {
  var assetApp = this.aapp

  var publicURL = asset.getPublicURL()
  if (!publicURL) {
    throw new Error('Asset has no publicURL configured.')
  }

  var publicPath = asset.getPublicPath()
  if (!publicPath) {
    throw new Error('Asset has no publicPath configured.')
  }

  var name = serviceName && '[' + serviceName + '] '
  publicURL.forEach(function(url) {
    debug(name + 'serve static files from "%s" for url "%s"', publicPath, url)
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
  if (!Array.isArray(url)) {
    url = [url]
  }

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
      method = method === 'default' ? 'use' : method
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
ExpressAdapter.prototype.attachMiddleware = function(middleware, router, service) {

  if (service.isRemote()) {
    this._attachRemoteMiddleware(middleware, router, service)
  } else {
    this._attachLocalMiddleware(middleware, router, service)
  }

  return this
}

ExpressAdapter.prototype.attachLocalMiddlewares = function(middlewares, service) {
  var self = this
  Object.keys(middlewares).forEach(function(mName) {
    var middleware = middlewares[mName]
    //
    self._attachLocalMiddleware(middleware, service)
  })
}

ExpressAdapter.prototype.attachRemoteMiddlewares = function(middlewares, service) {
  var self = this
  Object.keys(middlewares).forEach(function(mName) {
    var middleware = middlewares[mName]
    //
    self._attachRemoteMiddleware(middleware, service)
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

        changedReqKeys.forEach(function(key) {
          if (key !== 'read') { // @todo add more ignored names here
            _req[key] = req[key]
          }
        })

        changedHeaderKeys.forEach(function(key) {
          _headers[key] = req.headers[key]
        })

        if (Object.keys(_headers).length > 0) {
          _req.headers = _headers
        }

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

// Private function for processing remote middleware. This will not attach the
// middleware to the internal express app. Instead, it rebuilds the remote
// middleware handler so it could be used locally.
ExpressAdapter.prototype._attachRemoteMiddleware = function(middleware, service) {
  var _path = path.join(service.baseUrl, middleware.path)
  debug('[%s] rebuild remote middleware handler "%s" url "%s"', service.name, middleware.name, _path)

  // @todo support remote middleware options
  var handler = function() {
    // @todo this is a naive proxy implementation.
    return function(req, res, next) {
      var provider = service.scheduler.get()
      if (!provider) {
        Router.noProviderAvailable(req, res, next)
        return
      }

      var headers = assign({}, req.headers)
      delete headers['content-length'];

      var proxyReq = http.request({
        host: provider.address,
        port: provider.webPort,
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
        debug('[%s] proxy error', service.name, err.stack)
      })

      proxyReq.end()
    }
  }

  service.middleware[middleware.name] = handler
}
