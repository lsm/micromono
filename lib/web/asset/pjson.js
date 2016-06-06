var fs = require('fs')
var path = require('path')
var union = require('lodash.union')
var debug = require('debug')('micromono:asset:pjson')
var assign = require('lodash.assign')


exports.getAssetInfo = function(packagePath, packageJSON, serviceName) {
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

    // Bundles configurations.
    assetInfo.bundleDeps = micromono.bundleDeps
    assetInfo.ignoreDeps = micromono.ignoreDeps
    assetInfo.commonBundles = micromono.commonBundles
    // Relative urls of assets.
    assetInfo.entryJs = path.join(publicURL[0], assetInfo.main + (/\.js$/.test(assetInfo.main) ? '' : '.js'))
    assetInfo.bundleJs = micromono.bundleJs
    assetInfo.bundleCss = micromono.bundleCss
  }

  return {
    assetInfo: assetInfo,
    publicURL: publicURL,
    publicPath: publicPath
  }
}

exports.mergeAssetDependencies = function(dstAssetInfo, srcAssetInfo) {
  var assetDependenciesChanged = undefined

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

exports.filterServicesWithAsset = function(services) {
  var servicesWithAsset = []
  Object.keys(services).forEach(function(name) {
    var service = services[name]
    if (service.announcement.asset)
      servicesWithAsset.push(service)
  })

  return {
    servicesWithAsset: 0 < servicesWithAsset.length ? servicesWithAsset : undefined
  }
}

exports.getCommonAssetDependencies = function(servicesWithAsset) {
  var depsMap = {}
  servicesWithAsset.forEach(function(service) {
    var asset = service.announcement.asset
    var dependencies = asset.dependencies
    dependencies && Object.keys(dependencies).forEach(function(depName) {
      if (!depsMap[depName])
        depsMap[depName] = []
      depsMap[depName].push(service.name)
    })
  })

  return {
    assetDependenciesMap: depsMap
  }
}

exports.getCommonBundles = function(assetInfo, servicesWithAsset, assetDependenciesMap) {
  var numServices = servicesWithAsset.length
  // Any dependency required by 70% or more of the services
  // Minus any dependencies in assetInfo.micromono.bundleDeps
  // (which will be bundled with the main bundle.)
  // Minus any dependencies in assetInfo.micromono.ignoreDeps
  var common70 = []
  // Any dependency required by 50% or more but less than 70% of the services
  // Minus any dependencies in assetInfo.micromono.ignoreDeps
  var common50 = []
  // Any dependency required by 30% or more but less than 50% of the services
  // Minus any dependencies in assetInfo.micromono.ignoreDeps
  var common30 = []
  // All other dependencies
  // Minus any dependencies in assetInfo.micromono.ignoreDeps
  var common0 = []
  var commonBundles = {}

  var bundleDeps = assetInfo.bundleDeps || []
  var ignoreDeps = assetInfo.ignoreDeps || []

  function filter(percentage, requiredBy, depName) {
    return percentage <= requiredBy / numServices
      && -1 === ignoreDeps.indexOf(depName)
      && -1 === bundleDeps.indexOf(depName)
  }

  Object.keys(assetDependenciesMap).forEach(function(depName) {
    var requiredBy = assetDependenciesMap[depName].length
    if (filter(.7, requiredBy, depName)) {
      common70.push(depName)
    } else if (filter(.5, requiredBy, depName)) {
      common50.push(depName)
    } else if (filter(.3, requiredBy, depName)) {
      common30.push(depName)
    } else if (filter(0, requiredBy, depName)) {
      common0.push(depName)
    }
  })

  if (0 < common70.length)
    commonBundles.common70 = common70
  if (0 < common50.length)
    commonBundles.common50 = common50
  if (0 < common30.length)
    commonBundles.common30 = common30
  if (0 < common0.length)
    commonBundles.common0 = common0

  assetInfo.commonBundles = commonBundles
  return {
    commonBundles: commonBundles
  }
}

exports.updatePackageJSON = function(assetInfo, packagePath, packageJSON, next) {
  debug('Update package.json')

  var jspmInfo = packageJSON.jspm || {}
  jspmInfo.directories = assetInfo.directories
  jspmInfo.dependencies = assetInfo.dependencies
  packageJSON.jspm = jspmInfo

  packageJSON.micromono = packageJSON.micromono || {}

  if (assetInfo.bundleJs)
    packageJSON.micromono.bundleJs = assetInfo.bundleJs

  if (assetInfo.bundleCss)
    packageJSON.micromono.bundleCss = assetInfo.bundleCss

  if (assetInfo.commonBundles)
    packageJSON.micromono.commonBundles = assetInfo.commonBundles

  var pkgJSONStr = JSON.stringify(packageJSON, null, 2)
  fs.writeFile(path.join(packagePath, 'package.json'), pkgJSONStr, next)
}
