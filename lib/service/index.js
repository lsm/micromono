var util = require('util')
var debug = require('debug')('micromono:service')
var assign = require('lodash.assign')
var argsNames = require('js-args-names')
var AssetPipe = require('../web/asset')
var LocalPipe = require('./local')
var ServerPipe = require('../server/pipe')
var RemotePipe = require('./remote')
var ServicePipeline = require('./pipeline')
var listenProviders = require('../discovery').listenProviders

var discoveryArgs = require('../args/discovery').parse(process.argv)
var discovery = require('../discovery/' + discoveryArgs.discoveryBackend)


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
    .setDep(AssetPipe, '*^')
    .setDep(LocalPipe, '*^')
    .setDep(RemotePipe, '*^')
    .setDep('initFramework', ServerPipe.initFramework)
    .setDep('service', service)
    .setDep('micromonoOptions', micromonoOptions)
    // Dependencies for listening new providers for remote services
    .setDep('listen', discovery.listen)
    .setDep('services', this.services)
    .setDep('addProvider', RemotePipe.addProvider)
    .setDep('listenProviders', listenProviders)
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
