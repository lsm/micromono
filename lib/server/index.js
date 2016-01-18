var path = require('path')
var debug = require('debug')('micromono:server')
var Router = require('../web/router')
var SuperPipe = require('superpipe')
var argsNames = require('js-args-names')
var discovery = require('../discovery')
var AssetPipe = require('../web/asset/pipe')
var LocalPipe = require('../service/local')
var ServerPipe = require('./pipe')
var RemotePipe = require('../service/remote')
var udpDiscovery = require('../discovery/udp')
var ServicePipeline = require('../service/pipeline')
var ServerPipeline = require('../server/pipeline')


exports.startBalancer = function(app, opts, callback) {
  if ('function' === typeof opts) {
    callback = opts
    opts = undefined
  }

  opts = opts || {}
  var packagePath = ServerPipe.getCallerPath()
  var packageJSON = require(path.join(packagePath, 'package.json'))
  var balancerAsset = AssetPipe.getAssetInfo(packagePath, packageJSON, 'MicroMonoBalancer')
  var balancerAssetInfo = balancerAsset.assetInfo
  debug('Balancer packagePath %s', packagePath)

  var options = require('../argv').parse(process.argv)
  if (options.serviceDir) {
    this.serviceDir = options.serviceDir
  }

  var frameworkType = opts.framework || 'express'
  var framework = ServerPipe.initFramework(frameworkType).framework

  var superpipe = new SuperPipe()
  superpipe
    .autoBind(true)
    .setDep(Router, '*^')
    .setDep(LocalPipe, '*^')
    .setDep(RemotePipe, '*^')
    .setDep(ServerPipe, '*^')
    .setDep('mainApp', app || undefined)
    .setDep('require', this.require.bind(this))
    .setDep('options', require('../argv').parse(process.argv))
    .setDep('mainFramework', framework)
    .setDep('createPipeline', superpipe.pipeline.bind(superpipe))
    // Balancer asset management
    .setDep('balancerAsset', balancerAsset)
    .setDep('balancerAssetInfo', balancerAssetInfo)
    .setDep('updateBalancerPackageJSON', function(balancerAssetInfo, assetDependenciesChanged, next) {
      AssetPipe.updatePackageJSON(balancerAssetInfo, packagePath, packageJSON, next)
    })
    .setDep('mergeAssetInfo', function mergeBalancerAssetInfo(srcAssetInfo) {
      var result = AssetPipe.mergeAssetDependencies(balancerAssetInfo, srcAssetInfo)
      superpipe
        .setDep('balancerAssetInfo', result.balancerAssetInfo)
        .setDep('assetDependenciesChanged', result.assetDependenciesChanged)
    })
    // Dependencies for listening new providers for remote services
    .setDep('listen', udpDiscovery.listen)
    .setDep('addProvider', RemotePipe.addProvider)
    .setDep('listenProviders', discovery.listenProviders)
    .setDep('errorHandler', function(err, serviceName) {
      debug('[%s] `startBalancer` pipeline error', serviceName, err && err.stack || err)
      process.exit(-1)
    })

  var balancer = ServerPipeline.initBalancer.slice().connect(superpipe)
  balancer = balancer.concat(ServicePipeline.listenRemoteProviders)

  if ('function' === typeof callback) {
    balancer.pipe(callback, argsNames(callback))
  }

  balancer.error('errorHandler', [null, 'serviceName'])
  balancer()
}
