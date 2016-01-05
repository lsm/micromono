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
  // Start web server
  .pipe('startWebServer?',
    ['port', 'host', 'serviceName', 'startHttpServer', 'setDep'],
    ['httpServer', 'httpPort', 'httpHost'])
  // Attach request handlers and start RPC server
  .pipe('serveLocalAsset?', ['asset', 'serviceName'])
  .pipe('attachRoutes?', ['routes', 'service'])
  .pipe('attachLocalMiddlewares?', ['middlewares', 'service'])
  .pipe('startRPCServer?', ['rpc', 'rpcPort', 'host', 'service', 'setDep', 'next'])
  .pipe('generateAnnouncement',
    ['assetInfo', 'routes', 'uses', 'middlewares', 'service',
      'httpPort', 'framework', 'rpcApi', 'rpcPort', 'rpcType', 'host'
    ], 'announcement')
  .pipe('announceService', ['serviceName', 'announcement'])


exports.initRemoteService = SuperPipe
  .pipeline()
  .pipe('buildServiceFromAnnouncement',
    'announcement',
    ['uses', 'routes', 'scheduler',
      'middlewares', 'upgradeUrl', 'assetInfo',
      'service', 'serviceName'])
  .pipe('prepareFramework',
    ['framework', 'setDep'],
    ['injectAssetInfo', 'proxyAsset', 'attachRoutes',
      'attachRemoteMiddlewares', 'proxyWebsocket'])
  .pipe('makeProxyHandlers',
    ['getProxyHandler', 'scheduler', 'webServer', 'upgradeUrl'],
    ['proxyHandler', 'wsProxyHandler'])
  .pipe('injectAssetInfo?', ['assetInfo'])
  .pipe('addProxyHandlerToRoutes?', ['routes', 'proxyHandler'])
  .pipe('useMiddlewares?', ['uses', 'service', 'loadMiddleware', 'framework'])
  .pipe('proxyAsset?', ['assetInfo', 'proxyHandler', 'serviceName'])
  .pipe('attachRoutes?', ['routes', 'service'])
  .pipe('attachRemoteMiddlewares?', ['middlewares', 'service'])
  .pipe('proxyWebsocket?', ['upgradeUrl', 'wsProxyHandler'])


