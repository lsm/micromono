var path = require('path')
var Asset = require('./web/asset')
var debug = require('debug')('micromono:server')
var callsite = require('callsite')
var SuperPipe = require('superpipe')
var argsNames = require('js-args-names')
var discovery = require('./discovery')
var LocalPipe = require('./service/local')
var RemotePipe = require('./service/remote')
var udpDiscovery = require('./discovery/udp')
var ServicePipeline = require('./service/pipeline')


/**
 * Start a service with standalone internal web/rpc server.
 *
 * @param  {Service} ServiceClass Service class.
 */
exports.startService = function(Service) {
  var service
  if ('function' === typeof Service) {
    service = new Service()
  } else {
    service = Service
  }

  var superpipe = new SuperPipe()
  superpipe
    .autoBind(true)
    .setDep(LocalPipe, '*^')
    .setDep('service', service)
    .setDep('listenProviders', discovery.listenProviders)

  var packagePath = service.packagePath
  if (!packagePath) {
    // Guess package path based on the caller of this function
    packagePath = getCallerPath()
  }

  debug('packagePath %s', packagePath)

  superpipe.setDep('packagePath', packagePath)
  // Dependencies for listening new providers for remote services
  superpipe.setDep({
    services: this.services,
    listen: udpDiscovery.listen,
    addProvider: RemotePipe.addProvider
  })

  // Clone the pipeline and connect to local superpipe instance
  var pipeline = ServicePipeline.initLocalService.slice().connect(superpipe)

  // Start web server
  pipeline.pipe('startWebServer?',
    ['port', 'host', 'serviceName', 'startHttpServer', 'setDep'],
    ['httpServer', 'httpPort', 'httpHost'])

  if (service.init) {
    var initArgs = argsNames(service.init)
    // Add service.init to pipeline
    pipeline.pipe(service.init, initArgs)
  }

  pipeline = pipeline.concat(ServicePipeline.runLocalService)

  pipeline.error(function(err) {
    debug('`startService` pipeline error', err && err.stack || err)
    process.exit(-1)
  })

  // Execute the pipeline
  pipeline.toPipe()()
}


exports.startBalancer = function(app) {
  var packagePath = getCallerPath()
  var asset = new Asset(packagePath)
  var superpipe = new SuperPipe()

superpipe
  .pipeline()
  .pipe()
  .each('services', function () {

  })
}


function getCallerPath() {
  var stack = callsite()
  var callerFilename = stack[2].getFileName()
  return path.dirname(callerFilename)
}
