
var Asset = require('../web/asset')
var debug = require('debug')('micromono:server')
var Router = require('../web/router')
var SuperPipe = require('superpipe')
var argsNames = require('js-args-names')
var discovery = require('../discovery')
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
    .setDep('configBalancerAsset', asset.configJSPM.bind(asset))
    .setDep('mergeAssetInfo', asset.mergeJSPMDeps.bind(asset))
    .setDep('mainFramework', framework)
    .setDep('options', require('../argv').parse(process.argv))
    .setDep('createPipeline', superpipe.pipeline.bind(superpipe))
    .setDep('require', this.require.bind(this))
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
