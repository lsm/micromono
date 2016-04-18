var superpipe = require('superpipe')


exports.initLocalService = superpipe()
  // Gether service information
  .pipe('getServiceOptions', 'micromonoOptions')
  .pipe('getPackageJSON', 'packagePath', 'packageJSON')
  .pipe('getServiceInfo',
    ['packageJSON', 'service'],
    ['hasAsset', 'serviceName', 'serviceInfo', 'serviceVersion'])
  .pipe('prepareService', ['hasAsset', 'service'])
  .pipe('prepareDiscovery', null,
    ['discoveryListen', 'discoveryAnnounce', 'discoveryOptions'])
  // Setup web features
  .pipe('initFramework', ['frameworkType', 'framework'], 'framework')
  .pipe('prepareFrameworkForLocal?',
    ['framework', 'setDep'],
    ['app', 'attachRoutes', 'attachLocalMiddlewares',
      'startHttpServer', 'serveLocalAsset', 'injectAssetInfo'])

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
  .pipe('setupRPC?', ['api', 'rpcType', 'service'], ['rpc', 'rpcApi'])


exports.startServers = superpipe()
  // Start web server
  .pipe('startHttpServer?',
    ['port', 'host', 'serviceName', 'setDep'],
    ['httpServer', 'httpPort', 'httpHost'])
  // Start RPC server
  .pipe('startRPCServer?',
    ['rpc', 'rpcPort', 'rpcHost', 'service', 'setDep', 'next'])
  // Start channel server
  .pipe('startChannelServer?',
    ['chnAdapter', 'chnEndpoint', 'next'],
    ['chnEndpoint'])

exports.runLocalService = superpipe()
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
  //   ['assetInfo', 'publicPath', 'packagePath', 'setDep', 'bundle dev'])


exports.listenRemoteProviders = superpipe()
  .pipe('addRemoteServicesProvider', ['services', 'addProvider'])
  .pipe('listenProviders',
    ['services', 'discoveryListen', 'discoveryOptions', 'addProvider'])
  .pipe('checkRemoteServicesAvailability', 'services')

// Announcement
exports.announceLocalService = superpipe()
  .pipe('generateAnnouncement',
    ['service', 'serviceInfo', 'host',
      {
        asset: 'assetInfo',
        port: 'httpPort',
        host: 'host',
        route: 'routes',
        use: 'uses',
        middleware: 'middlewares',
        framework: 'framework'
      },
      {
        handlers: 'rpcApi',
        port: 'rpcPort',
        host: 'rpcHost',
        type: 'rpcType'
      },
      {
        endpoint: 'chnEndpoint',
        namespace: 'chnNamespace',
        REP: 'chnRepEvents'
      }
    ], 'announcement')
  .pipe('announceService',
    ['announcement', 'discoveryAnnounce', 'discoveryOptions'])


exports.initRemoteService = superpipe()
  .pipe('prepareRemoteService',
    ['service', 'announcement'],
    ['uses', 'routes', 'scheduler', 'middlewares', 'upgradeUrl',
      'assetInfo', 'serviceName'])
  .pipe('handleProviderRemoval', 'scheduler')
  .pipe('rebuildRemoteMiddlewares?', ['middlewares', 'service'])

  .pipe('initFramework', ['frameworkType', 'framework'], 'framework')
  .pipe('prepareFrameworkForRemote?',
    ['framework', 'setDep'],
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

exports.mergeAssetDependencies = superpipe()
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

