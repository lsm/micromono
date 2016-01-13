var path = require('path')
var Asset = require('../web/asset')
var debug = require('debug')('micromono:server')
var Router = require('../web/router')
var callsite = require('callsite')
var SuperPipe = require('superpipe')
var argsNames = require('js-args-names')
var discovery = require('../discovery')
var LocalPipe = require('../service/local')
var ServerPipe = require('./pipe')
var RemotePipe = require('../service/remote')
var udpDiscovery = require('../discovery/udp')
var ServicePipeline = require('../service/pipeline')
var ServerPipeline = require('../server/pipeline')


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

  var options = require('../argv').parse(process.argv)
  if (options.serviceDir) {
    this.serviceDir = options.serviceDir
  }

  var superpipe = new SuperPipe()
  superpipe
    .autoBind(true)
    .setDep(LocalPipe, '*^')
    .setDep(RemotePipe, '*^')
    .setDep('initFramework', ServerPipe.initFramework)
    .setDep('service', service)
    .setDep('options', options)
    // Dependencies for listening new providers for remote services
    .setDep('listen', udpDiscovery.listen)
    .setDep('services', this.services)
    .setDep('addProvider', RemotePipe.addProvider)
    .setDep('listenProviders', discovery.listenProviders)
    .setDep('errorHandler', function(err) {
      debug('`startService` pipeline error', err && err.stack || err)
      process.exit(-1)
    })

  var packagePath = service.packagePath
  if (!packagePath) {
    // Guess package path based on the caller of this function
    packagePath = getCallerPath()
  }

  debug('packagePath %s', packagePath)

  superpipe.setDep('packagePath', packagePath)

  // Clone the pipeline and connect to local superpipe instance
  var servicePipeline = ServicePipeline.initLocalService.slice().connect(superpipe)

  servicePipeline
    // Start web server
    .pipe('startWebServer?',
      ['port', 'host', 'serviceName', 'startHttpServer', 'setDep'],
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

  servicePipeline.error('errorHandler')
  // Execute the pipeline
  servicePipeline()
}

exports.startBalancer = function(app, opts, callback) {
  if ('function' === typeof opts) {
    callback = opts
    opts = undefined
  }

  opts = opts || {}
  var packagePath = getCallerPath()
  debug('packagePath %s', packagePath)

  var asset = new Asset(packagePath)
  asset.parseJSPM()
  var superpipe = new SuperPipe()

  var options = require('../argv').parse(process.argv)
  if (options.serviceDir) {
    this.serviceDir = options.serviceDir
  }

  var frameworkType = opts.framework || 'express'
  var framework = ServerPipe.initFramework(frameworkType).framework

  superpipe
    .autoBind(true)
    .setDep(Router, '*^')
    .setDep(LocalPipe, '*^')
    .setDep(RemotePipe, '*^')
    .setDep(ServerPipe, '*^')
    .setDep('mainApp', app || undefined)
    .setDep('balancerAsset', asset)
    .setDep('mergeAssetInfo', asset.mergeJSPMDeps.bind(asset))
    .setDep('mainFramework', framework)
    .setDep('options', require('../argv').parse(process.argv))
    .setDep('createPipeline', superpipe.pipeline.bind(superpipe))
    .setDep('require', this.require.bind(this))
    // Dependencies for listening new providers for remote services
    .setDep('listen', udpDiscovery.listen)
    .setDep('addProvider', RemotePipe.addProvider)
    .setDep('listenProviders', discovery.listenProviders)
    .setDep('errorHandler', function(err) {
      debug('`startBalancer` pipeline error', err && err.stack || err)
      process.exit(-1)
    })

  var balancer = ServerPipeline.initBalancer.slice().connect(superpipe)
  balancer = balancer.concat(ServicePipeline.listenRemoteProviders)

  if ('function' === typeof callback) {
    balancer.pipe(callback, argsNames(callback))
  }

  balancer.error('errorHandler')
  balancer()
}


function getCallerPath() {
  var stack = callsite()
  var callerFilename = stack[2].getFileName()
  return path.dirname(callerFilename)
}
