var superpipe = require('superpipe')

exports.bundleAsset = superpipe()
  .pipe('getPackageJSON', 'packagePath', 'packageJSON')
  .pipe('getServiceInfo',
    ['packageJSON', 'service'],
    ['hasAsset', 'serviceName', 'serviceInfo', 'serviceVersion'])
  .pipe('getAssetInfo',
    ['packagePath', 'packageJSON', 'serviceName'],
    ['assetInfo', 'publicURL', 'publicPath'])
  .pipe('prepareBundleInfo',
    ['assetInfo', 'publicPath', 'bundleOptions'],
    ['bundleCmd', 'bundleOptions'])
  .pipe('bundle', ['assetInfo', 'packagePath', 'bundleCmd', 'bundleOptions', 'next'])
