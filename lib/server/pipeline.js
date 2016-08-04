var Superpipe = require('superpipe')

exports.initBalancer = Superpipe.pipeline()
  .pipe('getServerOptions',
    'micromonoOptions',
    ['port', 'host', 'serviceNames', 'serviceDir'])
  .pipe('prepareFrameworkForBalancer',
    ['mainFramework', 'mainApp'],
    ['attachHttpServer', 'serveBalancerAsset'])
  .pipe('prepareDiscovery', null,
    ['discoveryListen', 'discoveryAnnounce', 'discoveryOptions'])
  .pipe('getJSPMConfig?', ['balancerAssetInfo', 'balancerPublicPath', 'next'],
    ['jspmConfig:balancerJSPMConfig', 'jspmConfigPath:balancerJSPMConfigPath'])
  .pipe('getJSPMBinPath', 'balancerPackagePath', 'jspmBinPath')
  .pipe('createHttpServer', ['setGlobal'], ['httpServer', 'setHttpRequestHandler'])
  .pipe('requireAllServices',
    ['serviceNames', 'serviceDir', 'require'],
    'services')
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
  .pipe('serveBalancerAsset', 'balancerAsset')
  // Start the Http server
  .pipe('attachHttpServer', ['httpServer', 'setHttpRequestHandler'])
  .pipe('startServer', ['httpServer', 'port', 'host', 'set'], ['httpPort', 'httpHost'])
