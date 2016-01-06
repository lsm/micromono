var ip = require('ip')
var RPC = require('../rpc')
var path = require('path')
var util = require('util')
var Asset = require('../web/asset')
var debug = require('debug')('micromono:service:pipe')
var Router = require('../web/router')
var discovery = require('../discovery/udp')
var Announcement = require('../announcement')

exports.getEnvVariables = function() {
  var argv = require('../argv').parse(process.argv)
  return {
    port: argv.port || process.env.PORT || 0,
    host: argv.host || process.env.HOST || ip.address() || '0.0.0.0',
    rpcPort: argv.rpcPort || 0
  }
}

exports.prepareService = function(hasAsset, service) {
  var hasWebFeature = !!(hasAsset || service.route || service.middleware)
  return {
    api: service.api,
    rpcType: service.rpcType || 'axon',
    use: service.use,
    init: service.init,
    page: service.page || {},
    route: service.route,
    framework: hasWebFeature && (service.framework || 'express'),
    middleware: service.middleware,
    upgradeUrl: service.upgradeUrl,
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
  service.version = packageJSON.version

  return {
    hasAsset: packageJSON.jspm,
    serviceName: serviceName,
    serviceInfo: packageJSON.micromono,
    serviceVersion: packageJSON.version
  }
}

exports.setupAsset = function(hasAsset, packageJSON) {
  var asset = new Asset(packageJSON)
  var assetInfo = asset.parseJSPM()
  return {
    asset: asset,
    assetInfo: assetInfo
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
  if (!startHttpServer) {
    // no need to start http server if we don't have asset or route to serve.
    debug('[%s] no need to start web server', serviceName)
    return true
  }

  debug('[%s] start web server at %s:%s', serviceName, host, port)

  startHttpServer(port, host, serviceName).then(function(server) {
    if (server) {
      var address = server.address()
      debug('[%s] web server started at %s:%s', serviceName, address.address, address.port)

      setDep({
        httpServer: server,
        httpPort: address.port,
        httpHost: address.address
      })
    } else {
      var error = util.format('[%s] Can not start web server', serviceName)
      throw new Error(error)
    }
  })
}

exports.setupRPC = function(api, rpcType) {
  var rpcOptions = {
    api: api,
    type: rpcType,
    isRemote: false
  }
  var rpc = new RPC(rpcOptions)

  return {
    rpc: rpc,
    rpcApi: rpc.getAPIs()
  }
}

exports.startRPCServer = function(rpc, rpcPort, rpcHost, service, setDep, next) {
  debug('[%s] start "%s" rpc server at %s:%s', service.name, rpc.type, rpcHost, rpcPort)
  return rpc.startServer(rpcPort, rpcHost).then(function(server) {
    if (server) {
      var address = server.address()
      setDep('rpcPort', address.port)
      debug('[%s] "%s" rpc server started at %s:%s',
        service.name,
        rpc.type,
        address.address,
        address.port
      )
    }
    next()
  })
}

exports.generateAnnouncement = function(assetInfo, routes, uses, middlewares, service, httpPort, framework, rpcApi, rpcPort, rpcType, host) {
  var ann = new Announcement(service)
  ann.host = host
  ann.httpPort = httpPort
  ann.asset = assetInfo

  if (uses || routes || middlewares) {
    ann.web = {
      use: uses,
      route: routes,
      framework: framework,
      middleware: middlewares,
      upgradeUrl: service.upgradeUrl
    }
  }

  if (rpcApi && rpcPort && rpcType) {
    ann.rpc = {
      api: rpcApi,
      port: rpcPort,
      type: rpcType
    }
  }

  var annStr = util.inspect(ann, {
    colors: true,
    depth: 4
  })
  debug('[%s] service started with announcement: \n%s\n', service.name, annStr)

  return {
    announcement: ann
  }
}

exports.announceService = function(serviceName, announcement) {
  debug('[%s] start announcing service', serviceName)
  discovery.announce(announcement)
}
