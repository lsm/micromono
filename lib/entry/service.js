var debug = require('debug')('micromono:entry:service')
var discovery = require('../discovery')
var AssetPipe = require('../web/asset')
var LocalPipe = require('../service/local')
var HealthPipe = require('../server/health')
var ServerPipe = require('../server/pipe')
var RemotePipe = require('../service/remote')
var ChnPipeline = require('../pipeline/channel')
var DiscoveryPipe = require('../discovery/pipe')
var ServicePipeline = require('../pipeline/service')
var ChannelBackendPipe = require('../channel/backend')


/**
 * Start a service with standalone internal servers (web, rpc and healthiness etc.).
 *
 * @param  {Micromono}          micromono         Micromono instance.
 * @param  {Function|Object}    Service           Service instance or constructor.
 * @param  {Function}           [callback]        Optional callback for getting called when the service is started.
 * @param  {Array}              [cbDependencies]  Array of dependencies names for the callback.
 */
exports.startService = function(micromono, Service, callback, cbDependencies) {
  // Get instance of service.
  var service = 'function' === typeof Service ? new Service() : Service
  // Prepare global service dependencies
  micromono
    .set(AssetPipe, '*^')
    .set(LocalPipe, '*^')
    .set(HealthPipe, '*^')
    .set(RemotePipe, '*^')
    .set(DiscoveryPipe, '*^')
    .set(ChannelBackendPipe, '*^')
    .set('service', service)
    .set('initChannel', ChnPipeline.initChannel)
    // Guess package path based on the caller of this function if not present.
    .set('packagePath', service.packagePath || ServerPipe.getCallerPath())
    .set('initFramework', ServerPipe.initFramework)
    .set('defaultDiscoveryOptions', discovery.getDiscoveryOptions(micromono))
    // Dependencies for listening new providers for remote services
    .set('errorHandler', function(err, serviceName) {
      debug('Service [%s] `startService` pipeline error', serviceName, err && err.stack || err)
      process.exit(1)
    })

  // Build the `startService` pipeline.
  var servicePipeline = micromono.superpipe('startService')
    .concat(ServicePipeline.initLocalService)
    .concat(ChnPipeline.setupChannel)
    .concat(ServicePipeline.startServers)
    // Insert service.init as a pipe.
    .concat(LocalPipe.getServiceInitPipeline(service))
    .concat(ServicePipeline.runLocalService)
    .concat(ServicePipeline.listenRemoteProviders)
    .concat(ServicePipeline.startHealthinessServer)
    .concat(ServicePipeline.announceLocalService)

  // Set error and debugging handlers.
  servicePipeline
    .error('errorHandler', [null, 'serviceName'])
    .debug(micromono.get('MICROMONO_DEBUG_PIPELINE') && debug)

  if (callback)
    servicePipeline.pipe(callback, cbDependencies)

  // Execute the pipeline.
  servicePipeline()
}
