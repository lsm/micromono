var Superpipe = require('superpipe')

exports.bundleAsset = Superpipe.pipeline()
  .pipe('getPackageJSON', 'packagePath', 'packageJSON')
  .pipe('getServiceInfo',
    ['packageJSON', 'service'],
    ['hasAsset', 'serviceName', 'serviceInfo', 'serviceVersion'])
  .pipe('getAssetInfo',
    ['packagePath', 'packageJSON', 'serviceName'],
    ['assetInfo', 'publicURL', 'publicPath'])
  .pipe('getJSPMBinPath', 'packagePath', 'jspmBinPath')
  .pipe('getJSPMConfig',
    ['assetInfo', 'publicPath', 'next'],
    ['jspmConfig', 'jspmConfigPath'])
  .pipe('prepareBundleInfo',
    ['assetInfo', 'publicPath', 'bundleOptions'],
    ['bundleCmd', 'bundleOptions'])
  .pipe('updateJSPMConfig', ['jspmConfigPath', 'jspmConfig', 'bundleOptions', 'next'])
  .pipe('bundle',
    ['assetInfo', 'packagePath', 'jspmBinPath', 'bundleCmd', 'bundleOptions', 'set'],
    ['bundleJs', 'bundleCss'])
  .pipe('getJSPMConfig',
    ['assetInfo', 'publicPath', 'next'],
    ['jspmConfig', 'jspmConfigPath'])
  .pipe('updateJSPMConfig', ['jspmConfigPath', 'jspmConfig', 'bundleOptions', 'next'])
  .pipe('updatePackageJSON', ['assetInfo', 'packagePath', 'packageJSON', 'next'])
