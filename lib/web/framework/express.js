var path = require('path')
var express = require('express')

/**
 * ExpressAdapter constructor
 */
function ExpressAdapter() {
  this.app = express()
}

/**
 * Get the instance of express app.
 *
 * @return {Express} A instance of express app
 */
ExpressAdapter.prototype.getApp = function() {
  return this.app
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
 * @return {ExpressAdapter}   The instance of adpater
 */
ExpressAdapter.prototype.attachRoute = function(route, service) {
  var method = route.method.toLowercase()
  var routePath = path.join(service.baseUrl, route.path)

  if (route.middleware) {
    this.app[method](routePath, route.middleware.map(function(m) {
      return m.bind(service)
    }), route.handler.bind(service))
  } else {
    this.app[method](routePath, route.handler.bind(service))
  }

  return this
}

ExpressAdapter.prototype.serveAsset = function(asset, router, service) {
  var app = this.getApp()
  var publicURL = asset.getPublicURL()

  if (service.isRemote()) {
    // proxy requests for static asset
    var assetHandler = router.getProxyHandler()
    publicURL.forEach(function(url) {
      var assetUrl = path.join(url, '*')
      app.get(assetUrl, assetHandler)
    })
  } else {
    var publicPath = asset.getPublicPath()
    publicURL.forEach(function(url) {
      app.use(url, express.static(publicPath))
    })
  }
}

/**
 * Allow upgraded requests proxy to the backend services. It will only be called
 * when micromono runs in balancer mode.
 *
 * @param  {String} url   The url which allows upgraded requests
 * @return {Function}     The handler function which takes
 *                        `req` (http.IncomingMessage) and
 *                        `res` (http.ServerResponse) as
 *                        arguments and do the actual proxy.
 */
ExpressAdapter.prototype.allowUpgrade = function(url, handler) {
  this.app.use(url, handler)
}
