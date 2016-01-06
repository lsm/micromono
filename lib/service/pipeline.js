var SuperPipe = require('superpipe')


exports.initLocalService = SuperPipe
  .pipeline()
  // Gether service information
  .pipe('getEnvVariables')
  .pipe('getPackageJSON', 'packagePath', 'packageJSON')
  .pipe('getServiceInfo',
    ['packageJSON', 'service'],
    ['hasAsset', 'serviceName', 'serviceInfo', 'serviceVersion'])
  .pipe('prepareService', ['hasAsset', 'service'])
  // Setup web features
  .pipe('prepareFramework?',
    ['framework', 'setDep'],
    ['app', 'attachRoutes', 'attachLocalMiddlewares', 'startHttpServer', 'serveLocalAsset'])
  .pipe('setupAsset?', ['hasAsset', 'packageJSON'], ['asset', 'assetInfo'])
  .pipe('setupRoute?', ['route', 'page', 'pageApiBaseUrl'], 'routes')
  .pipe('setupUse?', 'use', 'uses')
  .pipe('setupMiddleware?', ['middleware', 'middlewareBaseUrl'], 'middlewares')
  // Setup RPC
  .pipe('setupRPC?', ['api', 'rpcType'], ['rpc', 'rpcApi'])

exports.runLocalService = SuperPipe
  .pipeline()
  // Attach web request handlers
  .pipe('serveLocalAsset?', ['asset', 'serviceName'])
  .pipe('attachRoutes?', ['routes', 'service'])
  .pipe('attachLocalMiddlewares?', ['middlewares', 'service'])
  // Start RPC server
  .pipe('startRPCServer?', ['rpc', 'rpcPort', 'host', 'service', 'setDep', 'next'])
  .pipe('mergeAssetInfo?', ['assetInfo'])
  .pipe('addRemoteServicesProvider', ['services', 'addProvider'])
  // Announcement
  .pipe('generateAnnouncement',
    ['assetInfo', 'routes', 'uses', 'middlewares', 'service',
      'httpPort', 'framework', 'rpcApi', 'rpcPort', 'rpcType', 'host'
    ], 'announcement')
  .pipe('announceService', ['serviceName', 'announcement'])
  .pipe('listenProviders', ['services', 'listen', 'addProvider'])


exports.initRemoteService = SuperPipe
  .pipeline()
  .pipe('buildServiceFromAnnouncement',
    'announcement',
    ['uses', 'routes', 'scheduler',
      'middlewares', 'upgradeUrl', 'assetInfo',
      'service', 'serviceName'])
  .pipe('rebuildRemoteMiddlewares?', ['middlewares', 'service'])

  .pipe('prepareFramework',
    ['framework', 'setDep'],
    ['injectAssetInfo', 'proxyAsset', 'attachRoutes', 'proxyWebsocket'])

  .pipe('makeProxyHandlers',
    ['getProxyHandler', 'scheduler', 'webServer', 'upgradeUrl'],
    ['proxyHandler', 'wsProxyHandler'])
  .pipe('injectAssetInfo?', ['assetInfo'])
  .pipe('addProxyHandlerToRoutes?', ['routes', 'proxyHandler'])
  .pipe('useMiddlewares?', ['uses', 'service', 'loadMiddleware', 'framework'])
  .pipe('proxyAsset?', ['assetInfo', 'proxyHandler', 'serviceName'])
  .pipe('attachRoutes?', ['routes', 'service'])
  .pipe('proxyWebsocket?', ['upgradeUrl', 'wsProxyHandler'])
  .pipe('addProvider?', ['scheduler', 'announcement'])
  .pipe('mergeAssetInfo?', ['assetInfo'])


