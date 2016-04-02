var util = require('util')
var debug = require('debug')('micromono:service')
var assign = require('lodash.assign')
var argsNames = require('js-args-names')
var AssetPipe = require('../web/asset')
var LocalPipe = require('./local')
var ServerPipe = require('../server/pipe')
var RemotePipe = require('./remote')
var DiscoveryPipe = require('../discovery/pipe')
var ServicePipeline = require('./pipeline')


/**
 * Dummy constructor for defining service.
 */
exports.Service = function MicroMonoService() {}

/**
 * Create a service class from an object as its prototype.
 * @param  {Object} serviceObj Prototype object of the service class.
 * @return {Service}           Subclass of Service class.
 */
exports.createService = function(serviceObj) {
  var Service = function() {}
  util.inherits(Service, exports.Service)
  assign(Service.prototype, serviceObj)

  return Service
}

var prepareService = exports.prepareService = function(micromono, Service) {
  var service
  if ('function' === typeof Service)
    service = new Service()
  else
    service = Service

  var micromonoOptions = require('../args/rpc').parse(process.argv)
  if (micromonoOptions.serviceDir)
    micromono.serviceDir = micromonoOptions.serviceDir

  micromono
    .set(AssetPipe, '*^')
    .set(LocalPipe, '*^')
    .set(RemotePipe, '*^')
    .set(DiscoveryPipe, '*^')
    .set('initFramework', ServerPipe.initFramework)
    .set('service', service)
    .set('micromonoOptions', micromonoOptions)
    // Dependencies for listening new providers for remote services
    .set('addProvider', RemotePipe.addProvider)
    .set('errorHandler', function(err, serviceName) {
      debug('[%s] `startService` pipeline error', serviceName, err && err.stack || err)
      process.exit(-1)
    })

  var packagePath = service.packagePath
  if (!packagePath)
    // Guess package path based on the caller of this function
    packagePath = ServerPipe.getCallerPath(3)

  debug('packagePath %s', packagePath)

  micromono.set('packagePath', packagePath)
}

/**
 * Start a service with standalone internal web/rpc server.
 *
 * @param  {Service} ServiceClass Service class.
 */
exports.startService = function(micromono, Service, callback, dependencies) {
  prepareService(micromono, Service)
  // Clone the pipeline and connect to local superpipe instance
  var servicePipeline = ServicePipeline.initLocalService.clone()
  servicePipeline
    // Start web server
    .pipe('startHttpServer?',
      ['port', 'host', 'serviceName', 'setDep'],
      ['httpServer', 'httpPort', 'httpHost'])
    // Start RPC server
    .pipe('startRPCServer?',
      ['rpc', 'rpcPort', 'rpcHost', 'service', 'setDep', 'next'])

  var service = micromono.get('service')
  if (service.init) {
    var initArgs = argsNames(service.init)
    // Add service.init to pipeline
    servicePipeline.pipe(service.init.bind(service), initArgs)
  }

  servicePipeline = servicePipeline
    .concat(ServicePipeline.runLocalService)
    .concat(ServicePipeline.listenRemoteProviders)
    .concat(ServicePipeline.announceLocalService)

  servicePipeline.error('errorHandler', [null, 'serviceName'])

  if (callback)
    servicePipeline.pipe(callback, dependencies)

  // Execute the pipeline
  servicePipeline(micromono.superpipe)
}
