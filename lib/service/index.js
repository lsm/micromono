var util = require('util')
var debug = require('debug')('micromono:service')
var assign = require('lodash.assign')
var argsNames = require('js-args-names')
var discovery = require('../discovery')
var AssetPipe = require('../web/asset')
var LocalPipe = require('./local')
var ServerPipe = require('../server/pipe')
var RemotePipe = require('./remote')
var udpDiscovery = require('../discovery/udp')
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

/**
 * Start a service with standalone internal web/rpc server.
 *
 * @param  {Service} ServiceClass Service class.
 */
exports.startService = function(Service) {
  var service
  if ('function' === typeof Service)
    service = new Service()
  else
    service = Service

  var micromonoOptions = require('../args/rpc').parse(process.argv)
  if (micromonoOptions.serviceDir)
    this.serviceDir = micromonoOptions.serviceDir

  var superpipe = this.superpipe
  superpipe
    .autoBind(true)
    .setDep(AssetPipe, '*^')
    .setDep(LocalPipe, '*^')
    .setDep(RemotePipe, '*^')
    .setDep('initFramework', ServerPipe.initFramework)
    .setDep('service', service)
    .setDep('micromonoOptions', micromonoOptions)
    // Dependencies for listening new providers for remote services
    .setDep('listen', udpDiscovery.listen)
    .setDep('services', this.services)
    .setDep('addProvider', RemotePipe.addProvider)
    .setDep('listenProviders', discovery.listenProviders)
    .setDep('errorHandler', function(err, serviceName) {
      debug('[%s] `startService` pipeline error', serviceName, err && err.stack || err)
      process.exit(-1)
    })

  var packagePath = service.packagePath
  if (!packagePath)
    // Guess package path based on the caller of this function
    packagePath = ServerPipe.getCallerPath()

  debug('packagePath %s', packagePath)

  superpipe.setDep('packagePath', packagePath)

  // Clone the pipeline and connect to local superpipe instance
  var servicePipeline = ServicePipeline.initLocalService.clone(superpipe)

  servicePipeline
    // Start web server
    .pipe('startHttpServer?',
      ['port', 'host', 'serviceName', 'setDep'],
      ['httpServer', 'httpPort', 'httpHost'])
    // Start RPC server
    .pipe('startRPCServer?',
      ['rpc', 'rpcPort', 'rpcHost', 'service', 'setDep', 'next'])

  if (service.init) {
    var initArgs = argsNames(service.init)
    // Add service.init to pipeline
    servicePipeline.pipe(service.init, initArgs)
  }

  servicePipeline = servicePipeline
    .concat(ServicePipeline.runLocalService)
    .concat(ServicePipeline.listenRemoteProviders)
    .concat(ServicePipeline.announceLocalService)

  servicePipeline.error('errorHandler', [null, 'serviceName'])
  // Execute the pipeline
  servicePipeline()
}
