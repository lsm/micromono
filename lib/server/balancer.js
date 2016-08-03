var path = require('path')
var debug = require('debug')('micromono:server')
var Router = require('../web/router')
var ChnPipe = require('../channel/pipe')
var argsNames = require('js-args-names')
var AssetPipe = require('../web/asset')
var LocalPipe = require('../service/local')
var ServerPipe = require('./pipe')
var RemotePipe = require('../service/remote')
var DiscoveryPipe = require('../discovery/pipe')
var ServerPipeline = require('../server/pipeline')
var ServicePipeline = require('../service/pipeline')


module.exports = function startBalancer(app, opts, callback) {
  if ('function' === typeof opts) {
    callback = opts
    opts = undefined
  }

  opts = opts || {}
  var micromono = this
  var superpipe = micromono.superpipe
  var packagePath = ServerPipe.getCallerPath()
  var packageJSON = require(path.join(packagePath, 'package.json'))
  var balancerAsset = AssetPipe.getAssetInfo(packagePath, packageJSON, 'MicroMonoBalancer')
  var balancerAssetInfo = balancerAsset.assetInfo
  debug('Balancer packagePath %s', packagePath)

  require('../args/rpc')
  var micromonoOptions = require('../args/server').parse(process.argv)
  if (micromonoOptions.serviceDir)
    micromono.serviceDir = micromonoOptions.serviceDir

  var frameworkType = opts.framework || 'express'
  var framework = ServerPipe.initFramework(frameworkType).framework

  micromono
    .set(Router, '*^')
    .set(ChnPipe, '*^')
    .set(AssetPipe, '*^')
    .set(LocalPipe, '*^')
    .set(RemotePipe, '*^')
    .set(ServerPipe, '*^')
    .set(DiscoveryPipe, '*^')
    .set('mainApp', app || undefined)
    .set('require', micromono.require.bind(micromono))
    .set('micromono', micromono)
    .set('micromonoOptions', micromonoOptions)
    .set('mainFramework', framework)
    // Balancer asset management
    .set('balancerAsset', balancerAsset)
    .set('balancerAssetInfo', balancerAssetInfo)
    .set('balancerPackagePath', packagePath)
    .set('balancerPublicPath', balancerAsset.publicPath)
    .set('balancerPackageJSON', packageJSON)
    .set('errorHandler', function(err, errPipeName) {
      debug('[%s] `startBalancer` pipeline error', errPipeName, err && err.stack || err)
      process.exit(-1)
    })

  var balancer = ServerPipeline.initBalancer.concat(ServicePipeline.listenRemoteProviders)

  // Channel
  // @todo Why `chnGateway` can not be got from pipeline.
  balancer.pipe(function() {
    return {
      chnGateway: superpipe.get('chnGateway')
    }
  }, null, 'chnGateway')
  balancer.pipe('attachChnGatewayServer?', ['chnGateway', 'httpServer'])

  if ('function' === typeof callback)
    balancer.pipe(callback, argsNames(callback))

  balancer
    .error('errorHandler', [null, 'errPipeName'])
    .debug(micromono.get('MICROMONO_DEBUG_PIPELINE') && debug)

  balancer.toPipe(superpipe, 'startBalancer')()
}
