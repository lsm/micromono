var debug = require('debug')('micromono:entry:balancer')
var Router = require('../web/router')
var argsNames = require('js-args-names')
var discovery = require('../discovery')
var AssetPipe = require('../web/asset')
var LocalPipe = require('../service/local')
var HealthPipe = require('../server/health')
var ServerPipe = require('../server/pipe')
var RemotePipe = require('../service/remote')
var initBalancer = require('../pipeline/balancer').initBalancer
var DiscoveryPipe = require('../discovery/pipe')
var ServicePipeline = require('../pipeline/service')
var ChannelGatewayPipe = require('../channel/gateway')


exports.startBalancer = function(micromono, app, callback) {
  var packagePath = ServerPipe.getCallerPath()
  debug('Balancer packagePath "%s"', packagePath)

  // Use 3000 as default port for balancer
  if (!micromono.get('MICROMONO_PORT'))
    micromono.set('MICROMONO_PORT', 3000)

  // Use express as default web framework
  if (!micromono.get('mainFramework'))
    micromono.set('mainFramework', ServerPipe.initFramework('express').framework)

  // Set global dependencies for executing pipeline.
  micromono
    .set(Router, '*^')
    .set(AssetPipe, '*^')
    .set(LocalPipe, '*^')
    .set(HealthPipe, '*^')
    .set(RemotePipe, '*^')
    .set(ServerPipe, '*^')
    .set(DiscoveryPipe, '*^')
    .set(ChannelGatewayPipe, '*^')
    .set('mainApp', app || undefined)
    .set('micromono', micromono)
    .set('balancerPackagePath', packagePath)
    .set('defaultDiscoveryOptions', discovery.getDiscoveryOptions(micromono))
    .set('errorHandler', function(err, errPipeName) {
      debug('`startBalancer` pipeline [%s] error', errPipeName, err && err.stack || err)
      process.exit(1)
    })

  // Create the `startBalancer` pipeline.
  var balancer = micromono.superpipe('startBalancer')
    // Concat pipelines required for starting the balancer server.
    .concat(initBalancer)
    .concat(ServicePipeline.listenRemoteProviders)
    .concat(ServicePipeline.startHealthinessServer)

  // Set error and debugging handlers.
  balancer
    .error('errorHandler', [null, 'errPipeName'])
    .debug(micromono.get('MICROMONO_DEBUG_PIPELINE') && debug)

  // Add the callback function as the last pipe.
  if ('function' === typeof callback)
    balancer.pipe(callback, argsNames(callback))

  // Execute the pipeline.
  balancer()
}
