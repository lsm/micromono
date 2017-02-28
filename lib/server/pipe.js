var http = require('http')
var path = require('path')
var logger = require('../logger')('micromono:server:pipe')
var callsite = require('callsite')
var AssetPipe = require('../web/asset')
var argsNames = require('js-args-names')
var ServicePipeline = require('../pipeline/service')

exports.getCallerPath = function(num) {
  var stack = callsite()
  var callerFilename = stack[num || 2].getFileName()
  return path.dirname(callerFilename)
}

exports.getBalancerAsset = function(packagePath, balancerPackageJSON) {
  var balancerAsset = AssetPipe.getAssetInfo(packagePath, balancerPackageJSON, 'MicroMonoBalancer')
  return {
    balancerAsset: balancerAsset,
    balancerAssetInfo: balancerAsset.assetInfo,
    balancerPublicPath: balancerAsset.publicPath
  }
}

exports.getServiceNames = function(services) {
  var serviceNames
  if ('string' === typeof services) {
    serviceNames = services.split(',').map(function(srv) {
      return srv.trim()
    })
    if (0 === serviceNames.length)
      serviceNames = undefined
  }
  return {
    serviceNames: serviceNames
  }
}

exports.requireAllServices = function(serviceNames, serviceDir, require) {
  logger.info('Requiring all services', {
    services: serviceNames
  })

  var services = {}
  serviceNames.forEach(function(name) {
    services[name] = require(name, serviceDir)
  })

  return {
    services: services
  }
}

exports.initFramework = function(frameworkType, framework) {
  if (!framework && 'string' === typeof frameworkType) {
    logger.info('Initialize web framework adapter', {
      framework: frameworkType
    })
    var FrameworkAdapter = require('../web/framework/' + frameworkType)
    framework = new FrameworkAdapter()
  }

  return {
    framework: framework
  }
}

exports.prepareFrameworkForBalancer = function(framework, app) {
  framework.app = app
  return {
    serveBalancerAsset: function(balancerAsset) {
      if (balancerAsset.publicURL && balancerAsset.publicPath)
        framework.serveLocalAsset(balancerAsset.publicURL, balancerAsset.publicPath, 'MicroMonoBalancer')
    },
    attachHttpServer: framework.attachHttpServer.bind(framework)
  }
}

exports.createHttpServer = function(set) {
  var requestHandler

  function setHttpRequestHandler(fn) {
    requestHandler = fn
  }

  function serverHandler(req, res) {
    requestHandler(req, res)
  }

  var httpServer = http.createServer(serverHandler)
  // Set to global superpipe so the children pipelines can use it.
  set('httpServer', httpServer)

  return {
    httpServer: httpServer,
    setHttpRequestHandler: setHttpRequestHandler
  }
}

exports.runServices = function(micromono, services, runService, next) {
  var pipeline = micromono.superpipe()

  Object.keys(services).forEach(function(serviceName) {
    var service = services[serviceName]
    var serviceDepName = 'service:' + serviceName
    pipeline.pipe(function setServiceDepName() {
      var srv = {}
      srv[serviceDepName] = service
      return srv
    })
    pipeline.pipe(runService, [serviceDepName, 'micromono', 'next'])
  })

  pipeline.error('errorHandler')
  pipeline.pipe(next).toPipe(null, 'runServices')()
}

exports.runService = function(service, micromono, next) {
  logger.info('Run service', {
    service: service.name + '@' + service.version,
    isRemote: service.isRemote
  })

  var pipelineName = service.name
  var pipeline = micromono.superpipe()

  if (service.isRemote) {
    pipeline = buildRemoteServicePipeline(service, pipeline)
    pipelineName += ':runRemote'
  } else {
    pipeline = buildLocalServicePipeline(service, pipeline)
    pipelineName += ':runLocal'
  }

  pipeline = pipeline.concat(ServicePipeline.mergeAssetDependencies)

  pipeline
    .pipe(next)
    .error('errorHandler', [null, 'serviceName'])
    .debug(micromono.get('MICROMONO_DEBUG_PIPELINE') && logger.debug)

  // Execute the pipeline.
  pipeline.toPipe(null, pipelineName)()
}

function buildRemoteServicePipeline(service, pipeline) {
  pipeline.pipe(function prepareRemotePipeline(mainFramework) {
    return {
      'service': service,
      'framework': mainFramework,
      'announcement': service.announcement
    }
  }, ['mainFramework'], ['service', 'framework', 'announcement'])

  // The solution below is not optimal. Setup channel gateway should be happened
  // in the balancer pipeline level not individual services here (hence the move).
  // Left the following comments for referencing:
  //
  // `setGlobal` here won't work immediately since this part runs in the middle
  // of the balancer pipeline not a separate one. At the time we call `setGlobal`
  // the balancer pipeline already cloned the DI container so any changes made
  // to the global container will be isolated and has no impact for the on going
  // balancer pipeline. Although, it does avoid the recreation of the
  // `chnGateway` object for subsequential services.
  //
  // if (service.announcement.channel)
  //   pipeline.pipe('ensureChannelGateway', ['chnGateway', 'setGlobal'], 'chnGateway')

  return pipeline.concat(ServicePipeline.initRemoteService)
}

function buildLocalServicePipeline(service, pipeline) {
  // Initialize service
  pipeline = pipeline
    .pipe(function setService() {
      return {
        service: service,
        packagePath: service.packagePath
      }
    })
    .concat(ServicePipeline.initLocalService)

  // Add service.init to pipeline if exists
  if (service.init) {
    var initArgs = argsNames(service.init)
    pipeline.pipe(service.init, initArgs)
  }

  // Run service and prepare announcement.
  return pipeline
    .concat(ServicePipeline.runLocalService)
    .pipe('attachToMainFramework?', ['mainFramework', 'framework'])
    .pipe('generateAnnouncement',
      ['assetInfo', 'routes', 'uses', 'middlewares',
        'service', 'httpPort', 'framework', 'rpcApi',
        'rpcPort', 'rpcType', 'host', 'rpcHost'
      ], 'announcement')
}

exports.attachToMainFramework = function(mainFramework, framework) {
  if (mainFramework !== framework)
    mainFramework.app.use(framework.app)
}

exports.startWebServer = function(httpServer, port, host, set) {
  logger.debug('Start web server', {
    host: host,
    port: port
  })

  httpServer.listen(port, host, function() {
    var address = httpServer.address()

    logger.info('Web server started', address)

    set({
      httpPort: address.port,
      httpHost: address.address
    })
  })
}
