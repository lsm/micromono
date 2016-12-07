var Superpipe = require('superpipe')

exports.initBalancer = Superpipe.pipeline()
  .pipe('getPackageJSON', 'balancerPackagePath', 'packageJSON:balancerPackageJSON')
  .pipe('getBalancerAsset',
    ['balancerPackagePath', 'balancerPackageJSON'],
    ['balancerAsset', 'balancerAssetInfo', 'balancerPublicPath'])
  .pipe('getServiceNames', 'MICROMONO_SERVICES', 'serviceNames')
  .pipe('prepareFrameworkForBalancer',
    ['mainFramework', 'mainApp'],
    ['attachHttpServer', 'serveBalancerAsset'])
  .pipe('prepareDiscovery', ['defaultDiscoveryOptions'],
    ['discoveryListen', 'discoveryAnnounce', 'discoveryOptions'])
  .pipe('getJSPMConfig?', ['balancerAssetInfo', 'balancerPublicPath', 'next'],
    ['jspmConfig:balancerJSPMConfig', 'jspmConfigPath:balancerJSPMConfigPath'])
  .pipe('getJSPMBinPath', 'balancerPackagePath', 'jspmBinPath')
  .pipe('createHttpServer', ['setGlobal'], ['httpServer', 'setHttpRequestHandler'])
  .pipe('requireAllServices',
    ['serviceNames', 'MICROMONO_SERVICE_DIR', 'require'],
    'services')
  // Channel
  .pipe('ensureChannelGateway', ['services', 'setGlobal'], 'chnGateway')
  .pipe('runServices', ['micromono', 'services', 'runService', 'next'])
  // Get common bundles
  .pipe('filterServicesWithAsset', 'services', 'servicesWithAsset')
  .pipe('getCommonAssetDependencies?', 'servicesWithAsset', 'assetDependenciesMap')
  .pipe('getCommonBundles?',
    ['balancerAssetInfo', 'servicesWithAsset', 'assetDependenciesMap'],
    ['commonBundles'])
  // Update changes to package json
  .pipe('updatePackageJSON?',
    ['balancerAssetInfo', 'balancerPackagePath', 'balancerPackageJSON', 'next'])
  .pipe('bundleDevDependencies?',
    ['balancerAssetInfo', 'balancerPublicPath', 'balancerPackagePath', 'jspmBinPath', 'set', 'MICROMONO_BUNDLE_DEV'],
    ['bundleJs', 'bundleCss'])
  // .pipe('getJSPMConfig?', ['balancerAssetInfo', 'balancerPublicPath', 'next'],
  //   ['jspmConfig:balancerJSPMConfig', 'jspmConfigPath:balancerJSPMConfigPath'])
  // .pipe('updateJSPMConfig?', ['balancerJSPMConfigPath', 'balancerJSPMConfig', 'balancerAssetInfo', 'next'])
  .pipe('serveBalancerAsset?', 'balancerAsset')
  // Start the Http server
  .pipe('attachHttpServer', ['httpServer', 'setHttpRequestHandler'])
  .pipe('startServer',
    ['httpServer', 'MICROMONO_PORT', 'MICROMONO_HOST', 'set'],
    ['httpPort', 'httpHost'])
  // Start channel gateway server if necessary
  .pipe('attachChnGatewayServer?', ['chnGateway', 'httpServer'])
  // Start healthiness server
  .pipe('prepareHealthAliveHandler', ['healthAliveHandler'], 'healthAliveHandler')
  .pipe('prepareHealthFunctionalHandler', ['services', 'healthFunctionalHandler'], 'healthFunctionalHandler')
  .pipe('startHealthinessServer?', ['MICROMONO_HOST', 'MICROMONO_HEALTH_PORT', {
    alivePath: 'MICROMONO_HEALTH_ALIVE_PATH',
    aliveHandler: 'healthAliveHandler',
    functionalPath: 'MICROMONO_HEALTH_FUNCTIONAL_PATH',
    functionalHandler: 'healthFunctionalHandler'
  }])
