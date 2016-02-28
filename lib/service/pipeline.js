var superpipe = require('superpipe')


exports.initLocalService = superpipe()
  // Gether service information
  .pipe('getServiceOptions', 'options')
  .pipe('getPackageJSON', 'packagePath', 'packageJSON')
  .pipe('getServiceInfo',
    ['packageJSON', 'service'],
    ['hasAsset', 'serviceName', 'serviceInfo', 'serviceVersion'])
  .pipe('prepareService', ['hasAsset', 'service'])
  // Setup web features
  .pipe('initFramework', ['frameworkType', 'framework'], 'framework')
  .pipe('prepareFrameworkForLocal?',
    ['framework', 'setDep'],
    ['app', 'attachRoutes', 'attachLocalMiddlewares',
      'startHttpServer', 'serveLocalAsset', 'injectAssetInfo'])

  .pipe('getAssetInfo', ['packagePath', 'packageJSON', 'serviceName'], ['assetInfo', 'publicURL', 'publicPath'])
  .pipe('getJSPMConfig?', ['assetInfo', 'publicPath', 'next'], ['jspmConfig'])
  .pipe('injectAssetInfo?', ['assetInfo'])
  .pipe('setupRoute?', ['route', 'page', 'pageApiBaseUrl'], 'routes')
  .pipe('setupUse?', 'use', 'uses')
  .pipe('setupMiddleware?', ['middleware', 'middlewareBaseUrl'], 'middlewares')
  // Setup RPC
  .pipe('setupRPC?', ['api', 'rpcType', 'service'], ['rpc', 'rpcApi'])


exports.runLocalService = superpipe()
  // Attach web request handlers
  .pipe('serveLocalAsset?', ['publicURL', 'publicPath', 'serviceName'])
  .pipe('useMiddlewares?', ['uses', 'routes', 'service', 'loadMiddleware', 'mainFramework'])
  .pipe('attachRoutes?', ['routes', 'service'])
  .pipe('attachLocalMiddlewares?', ['middlewares', 'service'])
  .pipe('mergeAssetInfo?', ['assetInfo'])
  .pipe('prefixJSPMBundles?', ['assetInfo'], ['assetBundles'])


exports.listenRemoteProviders = superpipe()
  .pipe('addRemoteServicesProvider', ['services', 'addProvider'])
  .pipe('listenProviders', ['services', 'listen', 'addProvider'])
  .pipe('checkRemoteServicesAvailability', 'services')


exports.announceLocalService = superpipe()
  // Announcement
  .pipe('generateAnnouncement',
    ['serviceInfo', 'assetInfo', 'routes', 'uses', 'middlewares',
      'service', 'httpPort', 'framework', 'rpcApi',
      'rpcPort', 'rpcType', 'host', 'rpcHost'
    ], 'announcement')
  .pipe('announceService', ['serviceName', 'announcement'])


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
  .pipe('useMiddlewares?', ['uses', 'routes', 'service', 'loadMiddleware', 'mainFramework'])
  .pipe('attachRoutes?', ['routes', 'service'])
  .pipe('proxyWebsocket?', ['upgradeUrl', 'wsProxyHandler'])
  .pipe('addProvider?', ['scheduler', 'announcement'])
  .pipe('mergeAssetInfo?', ['assetInfo'])

