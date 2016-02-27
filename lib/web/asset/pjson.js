var fs = require('fs')
var path = require('path')
var union = require('lodash.union')
var debug = require('debug')('micromono:asset:pjson')
var assign = require('lodash.assign')


exports.getAssetInfo = function(packagePath, packageJSON, serviceName, jspmConfig) {
  serviceName = serviceName || ''

  var assetInfo
  var publicURL
  var publicPath
  var micromono = packageJSON.micromono || {}

  if (packageJSON.jspm) {
    assetInfo = assign({}, packageJSON.jspm)
    assetInfo.name = serviceName
    var directories = assetInfo.directories = assetInfo.directories || {}

    // Public url for generating other urls (e.g. config.js, system.js etc.)
    publicURL = micromono.publicURL || path.join(directories.baseURL || '/', serviceName)
    if (!Array.isArray(publicURL))
      publicURL = [publicURL]

    publicURL = publicURL.map(function(url) {
      if ('/' !== url[0])
        url = '/' + url
      return url
    })
    assetInfo.publicURL = publicURL

    // Local path for asset files.
    publicPath = path.join(packagePath, directories.baseURL || '/')

    // Entry script.
    assetInfo.main = assetInfo.main || 'index.js'

    // Bundles.
    assetInfo.bundleDeps = micromono.bundleDeps
    assetInfo.ignoreDeps = micromono.ignoreDeps
    // Expose bundle info.
    assetInfo.bundles = jspmConfig && jspmConfig.bundles
    // Relative urls of assets.
    assetInfo.entryJs = path.join(publicURL[0], assetInfo.main + (/\.js$/.test(assetInfo.main) ? '' : '.js'))
  } else {
    assetInfo = {
      name: serviceName,
      directories: {
        baseURL: 'public'
      },
      dependencies: {}
    }
  }

  return {
    assetInfo: assetInfo,
    publicURL: publicURL,
    publicPath: publicPath
  }
}

exports.mergeAssetDependencies = function(dstAssetInfo, srcAssetInfo) {
  var assetDependenciesChanged = false

  if (srcAssetInfo.dependencies) {
    var srcDeps = srcAssetInfo.dependencies
    var dstDeps = dstAssetInfo.dependencies
    debug('[%s] merging asset dependencies', srcAssetInfo.name, srcDeps)

    // Ignore deps bundled by services.
    var srcBundleDeps = srcAssetInfo.srcBundleDeps || []
    var dstIgnoreDeps = dstAssetInfo.ignoreDeps || []
    dstAssetInfo.ignoreDeps = union(dstIgnoreDeps, srcBundleDeps)

    // Merge
    Object.keys(srcDeps).forEach(function(depName) {
      var oldDep = dstDeps[depName]
      var newDep = srcDeps[depName]
      if (!oldDep) {
        dstDeps[depName] = newDep
        assetDependenciesChanged = true
      } else if (oldDep !== newDep) {
        debug('Conflicting package version: %s vs %s', oldDep, newDep)
      }
    })

    dstAssetInfo.dependencies = dstDeps
  }

  return {
    assetInfo: dstAssetInfo,
    assetDependenciesChanged: assetDependenciesChanged
  }
}

exports.updatePackageJSON = function(assetInfo, packagePath, packageJSON, next) {
  debug('Update property `jspm` of package.json')

  var jspmInfo = packageJSON.jspm || {}
  jspmInfo.directories = assetInfo.directories
  jspmInfo.dependencies = assetInfo.dependencies
  packageJSON.jspm = jspmInfo

  var pkgJSONStr = JSON.stringify(packageJSON, null, 2)
  fs.writeFile(path.join(packagePath, 'package.json'), pkgJSONStr, next)
}
