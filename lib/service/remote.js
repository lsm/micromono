var RPC = require('../api/rpc')
var debug = require('debug')('micromono:service:remote')
var Scheduler = require('../discovery/scheduler')


exports.buildServiceFromAnnouncement = function(ann) {
  var service = {
    isRemote: true,
    announcement: ann
  }

  service.name = ann.name
  service.version = ann.version
  service.timeout = ann.timeout
  service.scheduler = new Scheduler()

  service.scheduler.serviceName = ann.name

  if (ann.web) {
    service.use = ann.web.use
    service.route = ann.web.route
    service.middleware = ann.web.middleware
    service.upgradeUrl = ann.web.upgradeUrl
  }

  if (ann.api) {
    var rpcOptions = {
      ann: ann,
      api: ann.api.handlers,
      type: ann.api.type,
      isRemote: true,
      scheduler: service.scheduler
    }
    var rpc = new RPC(rpcOptions)
    service.api = rpc.getAPIs()
    service.rpcType = ann.api.type
  }

  return service
}

exports.handleProviderRemoval = function(scheduler) {
  scheduler.on('remove', function(provider) {
    if (provider.proxy) {
      debug('Closing service [%s] proxy of provider "%s"',
        provider.name, provider.proxy.options.target)
      provider.proxy.close()
    }
  })
}

exports.prepareRemoteService = function(service, announcement) {
  return {
    uses: service.use,
    channel: announcement.channel,
    routes: service.route,
    scheduler: service.scheduler,
    middlewares: service.middleware,
    upgradeUrl: service.upgradeUrl,
    assetInfo: announcement.asset,
    serviceName: service.name
  }
}

exports.prepareFrameworkForRemote = function(framework, set) {
  set(framework, ['injectAssetInfo', 'proxyAsset', 'attachRoutes', 'proxyWebsocket'])
}

exports.makeProxyHandlers = function(getProxyHandler, scheduler, httpServer, upgradeUrl) {
  var proxyHandler = getProxyHandler(scheduler)
  var wsProxyHandler

  if (upgradeUrl)
    wsProxyHandler = getProxyHandler(scheduler, httpServer, upgradeUrl)

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
  var _middlewareName = name
  try {
    debug('Try to load internal middleware "%s" for service [%s]', _middlewareName, service.name)
    return require('../web/middleware/' + _middlewareName)
  } catch (e) {
    debug('Can not find internal middleware "%s"', _middlewareName)
    return require(name)
  }
}

exports.useMiddlewares = function(uses, routes, service, loadMiddleware, framework) {
  Object.keys(uses).forEach(function(middlewareName) {
    debug('Service [%s] use middleware "%s"', service.name, middlewareName)
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

  debug('New provider for service [%s@%s] found at "%s"', ann.name, ann.version, ann.host)
  scheduler.add(ann)
}

exports.hasProvider = function(scheduler, ann) {
  return scheduler.hasItem(ann, function(old, ann) {
    return old.id === ann.id
  })
}

exports.addRemoteServicesProvider = function(services, addProvider) {
  Object.keys(services).forEach(function(serviceName) {
    var service = services[serviceName]
    if (service.isRemote)
      addProvider(service.scheduler, service.announcement)
  })
}

exports.checkRemoteServicesAvailability = function(services, discoveryOptions) {
  var minInterval = 3000
  var remoteServices = []

  Object.keys(services).forEach(function(serviceName) {
    var service = services[serviceName]
    if (service.isRemote) {
      var ann = service.announcement
      if (minInterval > ann.timeout)
        minInterval = ann.timeout > 1000 ? ann.timeout : 1000
      remoteServices.push(services[serviceName])
    }
  })

  function checkAvailability() {
    var now = Date.now()
    remoteServices.forEach(function(service) {
      var scheduler = service.scheduler
      scheduler.each(function(ann) {
        if (now - ann.lastSeen > ann.timeout) {
          debug('Provider "%s" of service [%s@%s] timeout', ann.host, ann.name, ann.version)
          scheduler.remove(ann)
        }
      })
      if (0 === scheduler.len()) {
        debug('\n\tNo available providers for service [%s@%s]. Waiting for new providers...',
          service.name, service.version)
        if (!service.timer) {
          service.timer = setTimeout(function() {
            if (0 === scheduler.len()) {
              console.error('\n\tLost all providers of service [%s@%s]. Exiting micromono...\n',
                service.name, service.version)
              process.exit(1)
            }
            service.timer = undefined
          }, discoveryOptions.MICROMONO_DISCOVERY_TIMEOUT)
        }
      }
    })
  }

  setInterval(checkAvailability, minInterval)
}
