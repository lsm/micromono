var superpipe = require('superpipe')

exports.initBalancer = superpipe()
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
  .pipe('runServices', ['createPipeline', 'services', 'runService', 'next'])
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
    ['balancerAssetInfo', 'balancerPublicPath', 'balancerPackagePath', 'jspmBinPath', 'set', 'bundle dev'],
    ['bundleJs', 'bundleCss'])
  // .pipe('getJSPMConfig?', ['balancerAssetInfo', 'balancerPublicPath', 'next'],
  //   ['jspmConfig:balancerJSPMConfig', 'jspmConfigPath:balancerJSPMConfigPath'])
  // .pipe('updateJSPMConfig?', ['balancerJSPMConfigPath', 'balancerJSPMConfig', 'balancerAssetInfo', 'next'])
  .pipe('serveBalancerAsset', 'balancerAsset')
  // Start the Http server
  .pipe('attachHttpServer', ['httpServer', 'setHttpRequestHandler'])
  .pipe('startServer', ['httpServer', 'port', 'host', 'set'], ['httpPort', 'httpHost'])
