var SuperPipe = require('superpipe')


exports.initLocalService = SuperPipe
  .pipeline()
  .pipe('getEnvVariables')
  .pipe('prepareService', 'service')
  .pipe('prepareFramework', 'framework', 'framework')
  .pipe('getPackageJSON', 'packagePath')
  .pipe('getServiceInfo', 'getServiceInfo')
  .pipe(
    'startWebServer',
    ['port', 'host', 'serviceName', 'framework:startHttpServer', 'setDep'],
    ['webServer', 'webPort', 'webHost'])
  .pipe('setupAsset', 'packageJSON', 'asset')
  .pipe('setupRoute', ['route', 'page', 'pageApiBaseUrl'], 'routes')
  .pipe('setupUse', 'use', 'uses')
  .pipe('setupMiddleware', ['middleware', 'middlewareBaseUrl'], 'middlewares')
