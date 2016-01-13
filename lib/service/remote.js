var RPC = require('../rpc')
var Scheduler = require('../scheduler')
var debug = require('debug')('micromono:service:remote')

exports.buildServiceFromAnnouncement = function(ann) {
  var service = {
    isRemote: true,
    announcement: ann
  }

  service.name = ann.name
  service.version = ann.version
  service.scheduler = new Scheduler()

  service.scheduler.serviceName = ann.name

  if (ann.web) {
    service.use = ann.web.use
    service.route = ann.web.route
    service.middleware = ann.web.middleware
    service.upgradeUrl = ann.web.upgradeUrl
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

  return service
}

exports.prepareRemoteService = function(service, announcement) {
  return {
    uses: service.use,
    routes: service.route,
    scheduler: service.scheduler,
    middlewares: service.middleware,
    upgradeUrl: service.upgradeUrl,
    assetInfo: announcement.assetInfo,
    serviceName: service.name
  }
}

exports.prepareFrameworkForRemote = function(framework, setDep) {
  setDep(framework, ['injectAssetInfo', 'proxyAsset', 'attachRoutes', 'proxyWebsocket'])
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

exports.useMiddlewares = function(uses, routes, service, loadMiddleware, framework) {
  Object.keys(uses).forEach(function(middlewareName) {
    debug('[%s] use middleware "%s"', service.name, middlewareName)
    var url = uses[middlewareName]
    // Load middleware module
    var middleware = loadMiddleware(middlewareName, service, framework)
    framework.useMiddleware(url, middleware, routes, service)
  })
}

exports.addProvider = function(scheduler, ann) {
  ann.lastSeen = Date.now()
  var oldAnn = exports.hasProvider(scheduler, ann)

  if (oldAnn) {
    oldAnn.lastSeen = Date.now()
    return
  }

  debug('[%s] new provider found at %s', ann.name, ann.host)
  scheduler.add(ann)
}

exports.hasProvider = function(scheduler, ann) {
  return scheduler.hasItem(ann, function(old, ann) {
    if (old.host && ann.host === old.host) {
      if (old.rpc && ann.rpc && ann.rpc.port === old.rpc.port) {
        return true
      } else if (old.web && ann.web && old.web.port && ann.web.port === old.web.port) {
        return true
      }
    }
  })
}

exports.addRemoteServicesProvider = function(services, addProvider) {
  Object.keys(services).forEach(function(serviceName) {
    var service = services[serviceName]
    if (service.isRemote) {
      addProvider(service.scheduler, service.announcement)
    }
  })
}

exports.checkRemoteServicesAvailability = function(services) {
  var interval = 1000
  var remoteServices = []

  Object.keys(services).forEach(function(serviceName) {
    var service = services[serviceName]
    if (service.isRemote) {
      var ann = service.announcement
      if (interval > ann.timeout) {
        interval = ann.timeout > 500 ? ann.timeout : 500
      }
      remoteServices.push(services[serviceName])
    }
  })

  function checkAvailability() {
    var now = Date.now()
    remoteServices.forEach(function(service) {
      var scheduler = service.scheduler
      scheduler.each(function(ann) {
        if (now - ann.lastSeen > ann.timeout) {
          debug('[%s] timeout provider "%s"', ann.name, ann.host)
          scheduler.remove(ann)
        }
      })
    })
  }

  setInterval(checkAvailability, interval)
}
