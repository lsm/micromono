var superpipe = require('superpipe')

exports.bundleAsset = superpipe()
  .pipe('getPackageJSON', 'packagePath', 'packageJSON')
  .pipe('getServiceInfo',
    ['packageJSON', 'service'],
    ['hasAsset', 'serviceName', 'serviceInfo', 'serviceVersion'])
  .pipe('getAssetInfo',
    ['packagePath', 'packageJSON', 'serviceName'],
    ['assetInfo', 'publicURL', 'publicPath'])
  .pipe('getJSPMConfig',
    ['assetInfo', 'publicPath', 'packagePath', 'next'],
    ['jspmConfig', 'jspmConfigPath', 'jspmBinPath'])
  .pipe('prepareBundleInfo',
    ['assetInfo', 'publicPath', 'bundleOptions'],
    ['bundleCmd', 'bundleOptions'])
  .pipe('updateJSPMConfig', ['jspmConfigPath', 'jspmConfig', 'bundleOptions', 'next'])
  .pipe('bundle',
    ['assetInfo', 'packagePath', 'jspmBinPath', 'bundleCmd', 'bundleOptions', 'next'],
    ['bundleJs', 'bundleCss'])
  .pipe('getJSPMConfig',
    ['assetInfo', 'publicPath', 'packagePath', 'next'],
    ['jspmConfig', 'jspmConfigPath', 'jspmBinPath'])
  .pipe('updateJSPMConfig', ['jspmConfigPath', 'jspmConfig', 'bundleOptions', 'next'])
  .pipe('updatePackageJSON', ['assetInfo', 'packagePath', 'packageJSON', 'next'])
