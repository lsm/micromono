var RPC = require('../api/rpc')
var path = require('path')
var util = require('util')
var debug = require('debug')('micromono:service:local')
var crypto = require('crypto')
var Router = require('../web/router')
var Superpipe = require('superpipe')
var argsNames = require('js-args-names')
var Announcement = require('../announcement')


exports.getPackageJSON = function(packagePath) {
  var pjsonPath = path.join(packagePath, 'package.json')
  var packageJSON

  try {
    packageJSON = require(pjsonPath)
  } catch (e) {
    // Set default settings when failed to load package.json
    packageJSON = {
      name: path.basename(packagePath),
      version: '0.0.0'
    }
    debug('Failed to load "%s", use default settings instead:\n', pjsonPath, packageJSON)
  }

  return {
    packageJSON: packageJSON
  }
}

exports.getServiceInfo = function(packageJSON, service) {
  var serviceName = packageJSON.name
  if (packageJSON.micromono && packageJSON.micromono.name)
    serviceName = packageJSON.micromono.name

  service.name = serviceName
  service.version = packageJSON.version

  return {
    hasAsset: packageJSON.jspm,
    serviceName: serviceName,
    serviceInfo: packageJSON.micromono,
    serviceVersion: packageJSON.version
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
    channel: service.channel,
    frameworkType: hasWebFeature && (service.framework || 'express'),
    middleware: service.middleware,
    upgradeUrl: service.upgradeUrl,
    pageApiBaseUrl: service.pageApiBaseUrl || path.join('/_api', service.name),
    middlewareBaseUrl: service.middlewareBaseUrl || path.join('/_middleware', service.name)
  }
}

exports.prepareFrameworkForLocal = function(framework, set) {
  debug('set framework type "%s"', framework.type)

  // App might be a function, set it directly to avoid autoBind.
  set('app', framework.app)
  set(framework, ['attachRoutes', 'attachLocalMiddlewares',
    'startHttpServer', 'serveLocalAsset', 'injectAssetInfo'])
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

exports.setupRPC = function(api, rpcType, service) {
  // Bind api functions with service instance
  Object.keys(api).forEach(function(apiName) {
    var handler = api[apiName]
    var args = argsNames(handler)
    handler = handler.bind(service)
    handler.args = args
    api[apiName] = handler
  })

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

exports.startRPCServer = function(rpc, rpcPort, rpcHost, next) {
  rpc.startServer(rpcPort, rpcHost, function(err, server) {
    if (!err && server)
      rpcPort = server.address().port
    next(err, {
      rpcPort: rpcPort
    })
  })
}

exports.getServiceInitPipeline = function(service) {
  var initPipeline = Superpipe.pipeline()
  if (service.init) {
    var srvInit = service.init
    if ('function' === typeof srvInit) {
      var initArgs = argsNames(srvInit)
      initPipeline.pipe(srvInit.bind(service), initArgs)
    } else if (Array.isArray(srvInit)) {
      initPipeline.pipe(srvInit[0].bind(service), srvInit[1], srvInit[2])
    }
  }
  return initPipeline
}

exports.generateAnnouncement = function(service, serviceInfo, host, web, api, channel) {
  var ann = new Announcement(service)
  ann.host = host
  if (web.asset)
    ann.asset = web.asset
  ann.timeout = 3000

  if (serviceInfo)
    ann.timeout = serviceInfo.timeout || ann.timeout

  if (web.use || web.route || web.middleware || web.asset) {
    var framework = web.framework
    web.framework = framework && framework.type || framework
    web.upgradeUrl = service.upgradeUrl
    delete web.asset
    ann.web = web
  }

  if (api.handlers && api.port && api.type)
    ann.api = api

  if (channel.endpoint && channel.namespace && channel.REP)
    ann.channel = channel

  var serviceId = crypto.createHash('sha256')
    .update(Date.now() + '')
    .update(JSON.stringify(ann))
    .update(crypto.randomBytes(128))
    .digest('hex')

  ann.id = serviceId

  var annStr = util.inspect(ann, {
    colors: true,
    depth: 4
  })
  debug('[%s] service started with announcement: \n%s\n', service.name, annStr)

  return {
    announcement: ann
  }
}

exports.announceService = function(announcement, discoveryAnnounce, discoveryOptions) {
  debug('[%s] start announcing service using backend "%s"',
    announcement.name, discoveryOptions.discoveryBackend)
  discoveryAnnounce(announcement, discoveryOptions)
}
