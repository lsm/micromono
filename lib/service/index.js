var util = require('util')
var debug = require('debug')('micromono:service')
var assign = require('lodash.assign')
var ChnPipe = require('../channel/pipe')
var Superpipe = require('superpipe')
var AssetPipe = require('../web/asset')
var LocalPipe = require('./local')
var HealthPipe = require('../server/health')
var ServerPipe = require('../server/pipe')
var RemotePipe = require('./remote')
var ChnPipeline = require('../channel/pipeline')
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
  // Get instance of service.
  var service = 'function' === typeof Service ? new Service() : Service
  // Prepare global service dependencies
  micromono
    .set(ChnPipe, '*^')
    .set(AssetPipe, '*^')
    .set(LocalPipe, '*^')
    .set(HealthPipe, '*^')
    .set(RemotePipe, '*^')
    .set(DiscoveryPipe, '*^')
    .set('service', service)
    .set('initChannel', ChnPipeline.initChannel)
    .set('initFramework', ServerPipe.initFramework)
    .set('defaultDiscoveryOptions', DiscoveryPipe.getDiscoveryOptions(micromono))
    // Guess package path based on the caller of this function if not present.
    .set('packagePath', service.packagePath || ServerPipe.getCallerPath(3))
    // Dependencies for listening new providers for remote services
    .set('errorHandler', function(err, serviceName) {
      debug('Service [%s] `startService` pipeline error', serviceName, err && err.stack || err)
      process.exit(1)
    })

  return service
}

/**
 * Start a service with standalone internal web/rpc server.
 *
 * @param  {Service} ServiceClass Service class.
 */
exports.startService = function(micromono, Service, callback, dependencies) {
  var service = prepareService(micromono, Service)

  // Build service pipeline
  var servicePipeline = Superpipe.pipeline()
    .concat(ServicePipeline.initLocalService)
    .concat(ChnPipeline.setupChannel)
    .concat(ServicePipeline.startServers)
    // Insert service.init as a pipe
    .concat(LocalPipe.getServiceInitPipeline(service))
    .concat(ServicePipeline.runLocalService)
    .concat(ServicePipeline.listenRemoteProviders)
    .concat(ServicePipeline.announceLocalService)

  servicePipeline
    .error('errorHandler', [null, 'serviceName'])
    .debug(micromono.get('MICROMONO_DEBUG_PIPELINE') && debug)

  if (callback)
    servicePipeline.pipe(callback, dependencies)

  // Execute the pipeline
  servicePipeline.toPipe(micromono.superpipe, 'startService')()
}
