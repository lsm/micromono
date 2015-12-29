var path = require('path')
var util = require('util')
var Asset = require('../web/asset')
var debug = require('debug')('micromono:service:pipe')
var Router = require('../web/router')

exports.getEnvVariables = function() {
  var argv = require('../argv').parse(process.argv)
  return {
    port: argv.port,
    host: argv.host
  }
}

exports.prepareService = function(service) {
  var hasWebFeature = !!(service.route || service.middleware)
  return {
    api: service.api,
    use: service.use,
    init: service.init,
    page: service.page,
    route: service.route,
    framework: hasWebFeature && (service.framework || 'express'),
    middleware: service.middleware,
    pageApiBaseUrl: service.pageApiBaseUrl || '/_api',
    middlewareBaseUrl: service.middlewareBaseUrl || '/_middleware'
  }
}

exports.prepareFramework = function(framework) {
  if (framework) {
    if ('string' === typeof framework) {
      var FrameworkAdapter = require('./framework/' + framework)
      framework = new FrameworkAdapter(this)
    }

    debug('set framework type "%s"', framework.type)
  }

  return {
    framework: framework
  }
}

exports.getPackageJSON = function(packagePath) {
  var packageJSONPath = path.join(packagePath, 'package.json')
  var packageJSON = require(packageJSONPath)
  return {
    packageJSON: packageJSON
  }
}

exports.getServiceInfo = function(packageJSON) {
  var serviceName = packageJSON.name
  if (packageJSON.micromono && packageJSON.micromono.name) {
    serviceName = packageJSON.micromono.name
  }

  return {
    serviceName: serviceName,
    serviceInfo: packageJSON.micromono,
    serviceVersion: packageJSON.version
  }
}

exports.setupAsset = function(packageJSON) {
  return {
    asset: packageJSON.jspm ? new Asset(packageJSON) : null
  }
}

exports.setupRoute = function(route, page, pageApiBaseUrl) {
  return {
    routes: route ? Router.normalizeRoutes(route, page, pageApiBaseUrl) : null
  }
}

exports.setupUse = function(use) {
  return {
    uses: use ? Router.normalizeUses(use) : null
  }
}

exports.setupMiddleware = function(middleware) {
  return {
    middlewares: middleware ? Router.normalizeMiddlewares(middleware) : null
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

  startHttpServer(port, host, function(server) {
    if (server) {
      var address = server.address()

      setDep('webServer', server)
      setDep('webPort', address.port)
      setDep('webHost', address.address)

      debug('[%s] web server started at %s:%s', serviceName, address.address, address.port)
    } else {
      var error = util.format('[%s] Can not start web server', serviceName)
      throw new Error(error)
    }
  })
}
