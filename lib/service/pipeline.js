var Superpipe = require('superpipe')


exports.initLocalService = Superpipe.pipeline()
  // Gether service information
  .pipe('getPackageJSON', 'packagePath', 'packageJSON')
  .pipe('getServiceInfo',
    ['packageJSON', 'service'],
    ['hasAsset', 'serviceName', 'serviceInfo', 'serviceVersion'])
  .pipe('prepareService', ['hasAsset', 'service'])
  .pipe('prepareDiscovery', ['defaultDiscoveryOptions'],
    ['discoveryListen', 'discoveryAnnounce', 'discoveryOptions'])
  // Setup web features
  .pipe('initFramework', ['frameworkType', 'framework'], 'framework')
  .pipe('prepareFrameworkForLocal?',
    ['framework', 'set'],
    ['app', 'attachRoutes', 'attachLocalMiddlewares', 'startHttpServer', 'serveLocalAsset', 'injectAssetInfo'])

  .pipe('getAssetInfo',
    ['packagePath', 'packageJSON', 'serviceName'],
    ['assetInfo', 'publicURL', 'publicPath'])
  .pipe('getJSPMConfig?', ['assetInfo', 'publicPath', 'next'],
    ['jspmConfig', 'jspmConfigPath'])
  .pipe('injectAssetInfo?', ['assetInfo'])
  .pipe('setupRoute?', ['route', 'page', 'pageApiBaseUrl'], 'routes')
  .pipe('setupUse?', 'use', 'uses')
  .pipe('setupMiddleware?', ['middleware', 'middlewareBaseUrl'], 'middlewares')
  // Setup RPC
  .pipe('setupRPC?', ['api', 'MICROMONO_RPC', 'service'], ['rpc', 'rpcApi'])


exports.startServers = Superpipe.pipeline()
  // Start web server
  .pipe('startHttpServer?',
    ['MICROMONO_PORT', 'MICROMONO_HOST', 'serviceName', 'set'],
    ['httpServer', 'httpPort', 'httpHost'])
  // Start RPC server
  .pipe('startRPCServer?',
    ['rpc', 'MICROMONO_RPC_PORT', 'MICROMONO_RPC_HOST', 'next'],
    ['rpcPort'])
  // Start channel server
  .pipe('startChnBackendServer?',
    ['channels', 'chnBackend', 'MICROMONO_CHN_ENDPOINT', 'next'],
    ['chnAnn'])

exports.runLocalService = Superpipe.pipeline()
  // Attach web request handlers
  .pipe('serveLocalAsset?', ['publicURL', 'publicPath', 'serviceName'])
  .pipe('useMiddlewares?',
    ['uses', 'routes', 'service', 'loadMiddleware', 'mainFramework'])
  .pipe('attachRoutes?', ['routes', 'service'])
  .pipe('attachLocalMiddlewares?', ['middlewares', 'service'])
  .pipe('mergeAssetDependencies?', ['balancerAssetInfo', 'assetInfo'],
    ['assetInfo:balancerAssetInfo', 'assetDependenciesChanged'])
  .pipe('prefixJSPMBundles?', ['assetInfo'], ['assetBundles'])
  // .pipe('bundleDevDependencies?',
  //   ['assetInfo', 'publicPath', 'packagePath', 'set', 'MICROMONO_BUNDLE_DEV'])


exports.listenRemoteProviders = Superpipe.pipeline()
  .pipe('addRemoteServicesProvider', ['services', 'addProvider'])
  .pipe('listenProviders',
    ['services', 'discoveryListen', 'discoveryOptions', 'addProvider'])
  .pipe('checkRemoteServicesAvailability', ['services', 'discoveryOptions'])

// Announcement
exports.announceLocalService = Superpipe.pipeline()
  .pipe('generateAnnouncement',
    ['service', 'serviceInfo', 'MICROMONO_HOST',
      {
        asset: 'assetInfo',
        port: 'httpPort',
        host: 'httpHost',
        route: 'routes',
        use: 'uses',
        middleware: 'middlewares',
        framework: 'framework'
      },
      {
        handlers: 'rpcApi',
        port: 'rpcPort',
        host: 'MICROMONO_RPC_HOST',
        type: 'MICROMONO_RPC'
      },
      'chnAnn'
    ], 'announcement')
  .pipe('announceService',
    ['announcement', 'discoveryAnnounce', 'discoveryOptions'])


exports.initRemoteService = Superpipe.pipeline()
  .pipe('prepareRemoteService',
    ['service', 'announcement'],
    ['uses', 'channel', 'routes', 'scheduler', 'middlewares', 'upgradeUrl',
      'assetInfo', 'serviceName'])
  .pipe('handleProviderRemoval', 'scheduler')

  // Web
  .pipe('rebuildRemoteMiddlewares?', ['middlewares', 'service'])
  .pipe('initFramework', ['frameworkType', 'framework'], 'framework')
  .pipe('prepareFrameworkForRemote?',
    ['framework', 'set'],
    ['injectAssetInfo', 'proxyAsset', 'attachRoutes', 'proxyWebsocket'])
  .pipe('makeProxyHandlers',
    ['getProxyHandler', 'scheduler', 'httpServer', 'upgradeUrl'],
    ['proxyHandler', 'wsProxyHandler'])
  .pipe('injectAssetInfo?', ['assetInfo'])
  .pipe('addProxyHandlerToRoutes?', ['routes', 'proxyHandler'])
  .pipe('proxyAsset?', ['assetInfo', 'proxyHandler', 'serviceName'])
  .pipe('useMiddlewares?',
    ['uses', 'routes', 'service', 'loadMiddleware', 'mainFramework'])
  .pipe('attachRoutes?', ['routes', 'service'])
  .pipe('proxyWebsocket?', ['upgradeUrl', 'wsProxyHandler'])
  .pipe('addProvider?', ['scheduler', 'announcement'])
  // Channel
  .pipe('connectToChannel?',
    ['channel', 'chnGateway', 'announcement', 'scheduler', 'next'])
  .pipe('channelOnNewProvider?', ['chnGateway', 'scheduler', 'channel'])


exports.mergeAssetDependencies = Superpipe.pipeline()
  .pipe('getJSPMBinPath', 'balancerPackagePath', 'jspmBinPath')
  .pipe('mergeAssetDependencies?', ['balancerAssetInfo', 'assetInfo'],
    ['assetInfo:balancerAssetInfo', 'assetDependenciesChanged'])
  .pipe('updatePackageJSON?',
    ['balancerAssetInfo', 'balancerPackagePath', 'balancerPackageJSON', 'next', 'assetDependenciesChanged'])
  .pipe('jspmInstall?', ['balancerPackagePath', 'jspmBinPath', 'next', 'assetDependenciesChanged'])
  .pipe('getJSPMConfig?', ['balancerAssetInfo', 'balancerPublicPath', 'next', 'assetDependenciesChanged'],
    ['jspmConfig:balancerJSPMConfig', 'jspmConfigPath:balancerJSPMConfigPath'])
  .pipe('updateJSPMConfig?',
    ['balancerJSPMConfigPath', 'balancerJSPMConfig', {
      bundles: 'assetBundles'
    }, 'next', 'assetDependenciesChanged'])
