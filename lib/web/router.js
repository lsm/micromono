var path = require('path')
var isArray = require('lodash.isarray')
var connect = require('connect')
var getFnArgs = require('./helper').getFnArgs
var httpProxy = require('http-proxy')
var difference = require('lodash.difference')


var Router = module.exports = function MicroMonoRouter(service) {
  this.service = service
  this.setFramework(service.framework)

  if (service.route) {
    this._routes = this.normalizeRoutes(service.route, service)
  }

  // We need a standalone connect instance for middleware
  if (service.middleware) {
    var middleware = service.middleware
    this.middlewareApp = connect()
    Object.keys(middleware).forEach(function(name) {
      // make sure we can use `this` in middleware to reference service instance
      middleware[name] = middleware[name].bind(service)
    })
  }
}

/**
 * Set the framework to use for this router
 *
 * @param {String|Object} framework The framework adapter name or object.
 */
Router.prototype.setFramework = function(framework) {
  if ('string' === typeof framework) {
    var FrameworkAdapter = require('./framework/' + framework)
    this.framework = new FrameworkAdapter()
  } else {
    this.framework = framework
  }

  return this
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
 * @param {Service} service Instance of service
 * @return {Object}         Formatted routes object.
 */
Router.prototype.normalizeRoutes = function(route, service) {
  var _routes = {}
  var proxyHandler
  if (service.isRemote()) {
    proxyHandler = this.getProxyHandler(service.baseUrl)
  }

  Object.keys(route).forEach(function(routePath) {
    var middleware
    var _route = _formatRoutePath(routePath)
    if (service.isRemote()) {
      //we don't need to handle middleware for this case as it's transparent to balancer
      var r = route[routePath]
      // use the args from remote
      _route.args = r.args
      // set the proxy handler
      _route.handler = proxyHandler
    } else {
      var routeHandler = route[routePath]

      if (isArray(routeHandler)) {
        middleware = routeHandler
        routeHandler = middleware.pop()
      }

      if (typeof routeHandler === 'string') {
        routeHandler = service[routeHandler]
      }

      _route.args = getFnArgs(routeHandler)
      _route.handler = routeHandler
      _route.middleware = middleware || null
    }

    _routes[routePath] = _route
  })

  return _routes
}

Router.prototype = {

  setRoutes: function(routes) {
    this._routes = routes
  },

  getRoutes: function() {
    return this._routes
  },

  getMiddlewares: function() {
    if (!this.middlewares) {
      this.middlewares = this.buildMiddlewares()
    }
    return this.middlewares
  },

  getProxyHandler: function(baseUrl, allowUpgrade) {
    baseUrl = baseUrl || '/'
    var proxy = httpProxy.createProxyServer()

    proxy.on('error', function(err, req, res) {
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      })

      res.end('Proxy error')
    })

    var service = this.service

    if (allowUpgrade) {
      baseUrl = allowUpgrade
      var re = new RegExp('^' + baseUrl)
      service.on('server', function(server) {
        server.on('upgrade', function(req, socket, head) {
          if (re.test(req.url)) {
            service.scheduleProvider(function(provider) {
              var target = 'http://' + provider.address + ':' + provider.webPort
              proxy.ws(req, socket, head, {
                target: target
              })
            })
          }
        })
      })
    }

    return function(req, res) {
      service.scheduleProvider(function(provider) {
        var target = 'http://' + provider.address + ':' + provider.webPort + baseUrl
        proxy.web(req, res, {
          target: target
        })
      })
    }
  },

  getUpgradeHandler: function() {
    var service = this.service
    if (!service.isRemote()) {
      return
    }

    var ann = service.announcement
    if (ann.allowUpgrade) {
      var handler = this.getProxyHandler(ann.baseUrl, ann.allowUpgrade)
      return handler
    }
  },

  buildRoutes: function() {
    var _routes = this.getRoutes()
    var service = this.service
    var framework = this.framework

    // build routes for http endpoints
    Object.keys(_routes).forEach(function(routeName) {
      framework.attachRoute(_routes[routeName], service)
    })

    // serve static assets if any
    if (service.asset) {
      framework.serveAsset(service.asset, this, service)
    }

    // handle upgrade requests (websockets)
    var upgradeUrl = service.allowUpgrade()
    if (upgradeUrl) {
      var upgradeHandler = this.getUpgradeHandler()
      framework.allowUpgrade(upgradeUrl, upgradeHandler)
    }
  },

  buildMiddlewares: function() {
    var service = this.service

    if (!service.isRemote() && service.middleware) {
      var middleware = service.middleware
      var middlewareApp = this.middlewareApp
      var middlewares = {}
      Object.keys(middleware).forEach(function(name) {
        var fullPath = path.join('/middleware/', service.baseUrl, name)
        middlewares[name] = {
          name: name,
          path: fullPath
        }

        // @todo support middleware options
        var middlewareFn = middleware[name]()
        middlewareApp.use(fullPath, function(req, res, next) {
          var semi = true

          // find out if the middleware wants to alter response
          var _writeHead = req.writeHead
          var _write = req.write
          var _end = req.end

          // record changes of `req` and `req.headers`
          var reqKeys = Object.keys(req)
          var headerKeys = Object.keys(req.headers)

          middlewareFn(req, res, function(err) {
            semi = _writeHead === req.writeHead && _write === req.write && _end === req.end

            if (err) {
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
                res.setHeader('X-MicroMono-Req', JSON.stringify(_req))
              }

              res.end()
            } else {
              // let the request go if this is a fully-remote middleware
              next()
            }
          })
        })
      })
      return middlewares
    }
  }
}

/**
 * MicroMonoRouter private functions.
 */

/**
 * [formatRoutePath description]
 * @param  {[type]} routePath [description]
 * @return {Object}           Route definition object
 */
function _formatRoutePath(routePath) {
  var _route = {}
  if (typeof routePath === 'string') {
    var _path = routePath.split('::')
    var method = 'get'
    if (_path.length === 2) {
      method = _path[0]
      _path = _path[1]
    } else {
      _path = routePath
    }
    _route = {
      name: routePath,
      method: method,
      path: _path
    }
  }
  return _route
}
