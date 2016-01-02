var path = require('path')
var util = require('util')
var Asset = require('../web/asset')
var debug = require('debug')('micromono:service:pipe')
var Router = require('../web/router')

exports.getEnvVariables = function() {
  var argv = require('../argv').parse(process.argv)
  return {
    port: argv.port || process.env.PORT || 0,
    host: argv.host || process.env.HOST || '0.0.0.0'
  }
}

exports.prepareService = function(hasAsset, service) {
  var hasWebFeature = !!(hasAsset || service.route || service.middleware)
  return {
    api: service.api,
    use: service.use,
    init: service.init,
    page: service.page || {},
    route: service.route,
    framework: hasWebFeature && (service.framework || 'express'),
    middleware: service.middleware,
    pageApiBaseUrl: service.pageApiBaseUrl || '/_api',
    middlewareBaseUrl: service.middlewareBaseUrl || '/_middleware'
  }
}

exports.prepareFramework = function(framework, setDep) {
  if ('string' === typeof framework) {
    var FrameworkAdapter = require('../web/framework/' + framework)
    framework = new FrameworkAdapter()
  }

  debug('set framework type "%s"', framework.type)

  // App might be a function, set it directly to avoid autoBind.
  setDep('app', framework.app)
  setDep(framework, ['attachRoutes', 'attachLocalMiddlewares', 'startHttpServer', 'serveLocalAsset'])
}

exports.getPackageJSON = function(packagePath) {
  var packageJSONPath = path.join(packagePath, 'package.json')
  var packageJSON = require(packageJSONPath)

  return {
    packageJSON: packageJSON
  }
}

exports.getServiceInfo = function(packageJSON, service) {
  var serviceName = packageJSON.name
  if (packageJSON.micromono && packageJSON.micromono.name) {
    serviceName = packageJSON.micromono.name
  }

  service.name = serviceName

  return {
    hasAsset: packageJSON.jspm,
    serviceName: serviceName,
    serviceInfo: packageJSON.micromono,
    serviceVersion: packageJSON.version
  }
}

exports.setupAsset = function(hasAsset, packageJSON) {
  return {
    asset: new Asset(packageJSON)
  }
}

exports.setupRoute = function(route, page, pageApiBaseUrl) {
  return {
    routes: Router.normalizeRoutes(route, page, pageApiBaseUrl)
  }
}

exports.setupUse = function(use) {
  return {
    uses: Router.normalizeUses(use)
  }
}

exports.setupMiddleware = function(middleware, middlewareBaseUrl) {
  return {
    middlewares: Router.normalizeMiddlewares(middleware, middlewareBaseUrl)
  }
}

exports.startWebServer = function(port, host, serviceName, startHttpServer, setDep) {
  debug('[%s] startWebServer()', serviceName)

  if (!startHttpServer) {
    // no need to start http server if we don't have asset or route to serve.
    debug('[%s] no need to start web server', serviceName)
    return true
  }

  port = port || 0
  host = host || '0.0.0.0'

  debug('[%s] start web server at %s:%s', serviceName, host, port)

  startHttpServer(port, host).then(function(server) {
    if (server) {
      var address = server.address()

      setDep('httpServer', server)
      setDep('httpPort', address.port)
      setDep('httpHost', address.address)

      debug('[%s] web server started at %s:%s', serviceName, address.address, address.port)
    } else {
      var error = util.format('[%s] Can not start web server', serviceName)
      throw new Error(error)
    }
  })
}
