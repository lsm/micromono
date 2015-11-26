var path = require('path')
var debug = require('debug')('micromono:router')
var isArray = require('lodash.isarray')
var getFnArgs = require('../helper').getFnArgs
var httpProxy = require('http-proxy')


var Router = module.exports = function MicroMonoRouter(service) {
  this.service = service
  this.setFramework(service.framework)

  if (service.route) {
    this._routes = this.normalizeRoutes(service.route, service)
  }

  if (service.isRemote()) {
    // Need to rebuild the middleware interfaces so that
    // they could be used right after the service has been required.
    this.buildMiddlewares()
  }
}

/**
 * Get the internal route definition object. Could be used for service announcement.
 * @return {Object} Route definition object.
 */
Router.prototype.getRoutes = function() {
  return this._routes
}

/**
 * Get the internal middleware definition object. Could be used for service announcement.
 * @return {Object} Middleware definition object.
 */
Router.prototype.getMiddlewares = function() {
  return this._middlewares
}

/**
 * Set the framework to use for this router.
 *
 * @param {String|Object} framework The framework adapter name or object.
 */
Router.prototype.setFramework = function(framework) {
  if ('string' === typeof framework) {
    var FrameworkAdapter = require('./framework/' + framework)
    this.framework = new FrameworkAdapter(this)
  } else {
    this.framework = framework
  }

  debug('set framework type "%s"', this.framework.type)

  return this
}

Router.prototype.startServer = function(port, host) {
  return this.framework.startServer(port, host, this.service)
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
Router.prototype.normalizeRoutes = function(route, service) {
  debug('[%s] nomalizing routes', service.name)

  var _routes = {}
  var proxyHandler
  if (service.isRemote()) {
    proxyHandler = this.getProxyHandler()
  }

  Object.keys(route).forEach(function(routePath) {
    var middleware
    var routeHandler = route[routePath]
    var _route = _formatRoutePath(routePath, service.baseUrl)

    if (service.isRemote()) {
      // we don't need to handle middleware for this case as it's transparent to balancer
      // Use the args from remote.
      _route.args = routeHandler.args
      // Set the proxy handler.
      _route.handler = proxyHandler
    } else {
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

/**
 * Process and attach internal routes, asset handlers and middlewares to the web framework.
 *
 * @return {Router} Instance of Router.
 */
Router.prototype.buildRoutes = function() {
  var router = this
  var _routes = this.getRoutes()
  var service = this.service
  var framework = this.framework

  debug('[%s] building routes with framework "%s"', service.name, framework.type)

  // build routes for http endpoints
  if (_routes) {
    Object.keys(_routes).forEach(function(routeName) {
      framework.attachRoute(_routes[routeName], router, service)
    })
  }

  // serve static assets if any
  if (service.asset) {
    framework.serveAsset(service.asset, router, service)
  }

  // handle upgrade requests (websockets)
  var upgradeUrl = service.allowUpgrade()
  if (upgradeUrl && service.isRemote()) {
    debug('[%s] allow proxy upgrade requests at "%s"', service.name, upgradeUrl)
    var upgradeHandler = this.getProxyHandler(upgradeUrl, true)
    framework.allowUpgrade(upgradeUrl, upgradeHandler, router, service)
  }

  if (!service.isRemote()) {
    this.buildMiddlewares()
  }

  return this
}

Router.prototype.buildMiddlewares = function() {
  var router = this
  var service = this.service
  var framework = this.framework

  // build routes for http middleware endpoints
  if (service.middleware) {
    var middleware = service.middleware
    var _middlewares = {}
    Object.keys(middleware).forEach(function(name) {
      _middlewares[name] = {
        name: name,
        path: path.join('/middleware/', name),
        handler: middleware[name]
      }
      framework.attachMiddleware(_middlewares[name], router, service)
    })
    this._middlewares = _middlewares
  }

  return this
}

/**
 * Get a function which proxy the requests to the real services.
 *
 * @param  {String} baseUrl      The base url for the target endpoint of the service.
 * @param  {String} allowUpgrade The url for upgrade request (websockets).
 * @return {Function}            The proxy handler function.
 */
Router.prototype.getProxyHandler = function(baseUrl, allowUpgrade) {
  var proxyUrl = path.join('/', baseUrl || '/')
  var proxy = httpProxy.createProxyServer()

  proxy.on('error', function(err, req, res) {
    if (res) {
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      })
      res.end('Service error')
    }
    console.error('proxy error', err.stack)
  })

  var self = this
  var service = this.service
  var scheduler = service.scheduler

  if (allowUpgrade) {
    var re = new RegExp('^' + proxyUrl)
    service.on('server', function(server) {
      server.on('upgrade', function(req, socket, head) {
        if (re.test(req.url)) {
          var provider = scheduler.get()
          if (!provider) {
            self.noProviderAvailable(req, socket)
          } else {
            var target = 'http://' + provider.address + ':' + provider.webPort
            proxy.ws(req, socket, head, {
              target: target
            })
          }
        }
      })
    })
  }

  return function(req, res) {
    var provider = scheduler.get()
    if (!provider) {
      self.noProviderAvailable(req, res)
    } else {
      var target = 'http://' + provider.address + ':' + provider.webPort + proxyUrl
      proxy.web(req, res, {
        target: target
      })
    }
  }
}

Router.prototype.noProviderAvailable = function(req, res, next) {
  res.writeHead(500)
  res.end('No service currently available')
}

/**
 * MicroMonoRouter private functions.
 */

/**
 * [formatRoutePath description]
 * @param  {[type]} routePath [description]
 * @return {Object}           Route definition object
 */
function _formatRoutePath(routePath, baseUrl, defaultMethod) {
  var _route = {}
  if (typeof routePath === 'string') {
    var _path = routePath.split('::')
    var method = defaultMethod || 'get'
    if (_path.length === 2) {
      method = _path[0]
      _path = _path[1]
    } else {
      _path = routePath
    }

    // We remove the `^` if path starts with `^`
    // Otherwise, prefix the route path with `baseUrl`
    if ('^' === _path[0]) {
      _path = _path.slice(1)
    } else {
      _path = path.join(baseUrl, _path)
    }

    _route = {
      name: routePath,
      method: method,
      path: _path
    }
  }
  return _route
}
