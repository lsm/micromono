var RPC = require('../rpc')
var Scheduler = require('../scheduler')
var debug = require('debug')('micromono:service:remote')

exports.buildServiceFromAnnouncement = function(ann) {
  var service = {
    isRemote: true
  }

  service.name = ann.name
  service.version = ann.version
  service.scheduler = new Scheduler()

  if (ann.web) {
    // service.use = ann.web.use
    // service.route = ann.web.route
    service.middleware = ann.web.middleware
  // service.upgradeUrl = ann.web.upgradeUrl
  }

  if (ann.rpc) {
    var rpcOptions = {
      api: ann.rpc.api,
      type: ann.rpc.type,
      isRemote: true,
      scheduler: service.scheduler
    }
    var rpc = new RPC(rpcOptions)
    service.api = rpc.getAPIs()
    service.rpcType = ann.rpc.type
  }

  return {
    uses: ann.web && ann.web.use,
    routes: ann.web && ann.web.route,
    scheduler: service.scheduler,
    middlewares: service.middleware,
    upgradeUrl: ann.web && ann.web.upgradeUrl,
    assetInfo: ann.asset,
    service: service,
    serviceName: service.name
  }
}

exports.prepareFramework = function(framework, setDep) {
  // setDep('app', framework.app)
  setDep(framework, ['injectAssetInfo', 'proxyAsset', 'attachRoutes',
    'attachRemoteMiddlewares', 'proxyWebsocket'])
}

exports.makeProxyHandlers = function(getProxyHandler, scheduler, webServer, upgradeUrl) {
  var proxyHandler = getProxyHandler(scheduler)
  var wsProxyHandler

  if (upgradeUrl) {
    wsProxyHandler = getProxyHandler(scheduler, webServer, upgradeUrl)
  }

  return {
    proxyHandler: proxyHandler,
    wsProxyHandler: wsProxyHandler
  }
}

exports.addProxyHandlerToRoutes = function(routes, proxyHandler) {
  Object.keys(routes).forEach(function(routePath) {
    var route = routes[routePath]
    route.handler = proxyHandler
  })
}

exports.loadMiddleware = function(name, service, framework) {
  var _middlewareName = framework ? framework.type + '-' + name : name
  try {
    debug('[%s] try to load internal middleware "%s"', service.name, _middlewareName)
    return require('../web/middleware/' + _middlewareName)
  } catch (e) {
    return require(name)
  }
}

exports.useMiddlewares = function(use, service, loadMiddleware, framework) {
  Object.keys(use).forEach(function(middlewareName) {
    debug('[%s] use middleware "%s"', service.name, middlewareName)
    var url = use[middlewareName]
    // Load middleware module
    var middleware = loadMiddleware(middlewareName, service, framework)
    framework.useMiddleware(url, middleware, service)
  })
}

exports.addProvider = function(services, ann) {
  var remoteService
  Object.keys(services).some(function(serviceName) {
    var service = services[serviceName]
    if (true === service.isRemote && service.name === ann.name) {
      remoteService = service
      return true
    }
    return false
  })

  if (!remoteService || exports.hasProvider(remoteService.scheduler, ann)) {
    return
  }

  remoteService.scheduler.add(ann)
  debug('[%s] new provider found at %s', ann.name, ann.address)
}

exports.hasProvider = function(scheduler, ann) {
  return scheduler.hasItem(ann, function(old, ann) {
    if (old.address && ann.address === old.address) {
      if (old.rpcPort && ann.rpcPort === old.rpcPort) {
        return true
      } else if (old.webPort && ann.webPort === old.webPort) {
        return true
      }
    }
  })
}
