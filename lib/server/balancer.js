var path = require('path')
var debug = require('debug')('micromono:server')
var Router = require('../web/router')
var argsNames = require('js-args-names')
var discovery = require('../discovery')
var AssetPipe = require('../web/asset')
var LocalPipe = require('../service/local')
var ServerPipe = require('./pipe')
var RemotePipe = require('../service/remote')
var udpDiscovery = require('../discovery/udp')
var ServicePipeline = require('../service/pipeline')
var ServerPipeline = require('../server/pipeline')


module.exports = function startBalancer(app, opts, callback) {
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

  var options = require('../args/server').parse(process.argv)
  if (options.serviceDir)
    this.serviceDir = options.serviceDir

  var frameworkType = opts.framework || 'express'
  var framework = ServerPipe.initFramework(frameworkType).framework

  var superpipe = this.superpipe
  superpipe
    .autoBind(true)
    .setDep(Router, '*^')
    .setDep(AssetPipe, '*^')
    .setDep(LocalPipe, '*^')
    .setDep(RemotePipe, '*^')
    .setDep(ServerPipe, '*^')
    .setDep('mainApp', app || undefined)
    .setDep('require', this.require.bind(this))
    .setDep('options', options)
    .setDep('mainFramework', framework)
    .setDep('createPipeline', superpipe.pipeline.bind(superpipe))
    // Balancer asset management
    .setDep('balancerAsset', balancerAsset)
    .setDep('balancerAssetInfo', balancerAssetInfo)
    .setDep('balancerPackagePath', packagePath)
    .setDep('balancerPublicPath', balancerAsset.publicPath)
    .setDep('updateBalancerPackageJSON', function(balancerAssetInfo, assetDependenciesChanged, next) {
      AssetPipe.updatePackageJSON(balancerAssetInfo, packagePath, packageJSON, next)
    })
    .setDep('mergeAssetInfo', function mergeBalancerAssetInfo(serviceAssetInfo) {
      var result = AssetPipe.mergeAssetDependencies(balancerAssetInfo, serviceAssetInfo)
      superpipe
        .setDep('balancerAssetInfo', result.balancerAssetInfo)
        .setDep('assetDependenciesChanged', result.assetDependenciesChanged)
    })
    .setDep('updateBalancerJSPMBundles',
      function updateBalancerJSPMConfig(assetBundles, next) {
        var jspmConfig = superpipe.getDep('jspmConfig')
        AssetPipe.updateJSPMConfig(balancerAsset.publicPath, jspmConfig, {
          bundles: assetBundles
        }, next)
      })
    // Dependencies for listening new providers for remote services
    .setDep('listen', udpDiscovery.listen)
    .setDep('addProvider', RemotePipe.addProvider)
    .setDep('listenProviders', discovery.listenProviders)
    .setDep('errorHandler', function(err, errPipeName, errPipeBody) {
      debug('[%s] `startBalancer` pipeline error', errPipeName, errPipeBody, err && err.stack || err)
      process.exit(-1)
    })

  var balancer = ServerPipeline.initBalancer.slice().connect(superpipe)
  balancer = balancer.concat(ServicePipeline.listenRemoteProviders)

  if ('function' === typeof callback)
    balancer.pipe(callback, argsNames(callback))

  balancer.error('errorHandler', [null, 'errPipeName', 'errPipeBody'])
  balancer()
}
