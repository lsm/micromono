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
  .pipe('getJSPMConfig?', ['balancerAssetInfo', 'balancerPublicPath', 'next'], ['jspmConfig'])
  .pipe('createHttpServer', ['set'], ['httpServer', 'setHttpRequestHandler'])
  .pipe('requireAllServices',
    ['serviceNames', 'serviceDir', 'require'],
    'services')
  .pipe('runServices', ['createPipeline', 'services', 'runService', 'next'])
  .pipe('updateBalancerPackageJSON?',
    ['balancerAssetInfo', 'assetDependenciesChanged', 'next'])
  .pipe('bundleDevDependencies?',
    ['balancerAssetInfo', 'balancerPublicPath', 'balancerPackagePath', 'next', 'bundle dev'])
  .pipe('serveBalancerAsset', 'balancerAsset')
  .pipe('attachHttpServer', ['httpServer', 'setHttpRequestHandler'])
  .pipe('startServer', ['httpServer', 'port', 'host', 'setDep'], ['httpPort', 'httpHost'])
