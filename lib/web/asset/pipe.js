var fs = require('fs')
var path = require('path')
var union = require('lodash.union')
var debug = require('debug')('micromono:asset:pipe')
var assign = require('lodash.assign')
var child_process = require('child_process')

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
    if (!Array.isArray(publicURL)) {
      publicURL = [publicURL]
    }
    publicURL = publicURL.map(function(url) {
      if (url[0] !== '/') {
        url = '/' + url
      }
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
    assetInfo.bundles = loadBundleInfo(publicPath)
    // Relative urls of assets.
    assetInfo.urls = {
      configJs: path.join(publicURL[0], '/config.js'),
      systemJs: path.join(publicURL[0], '/jspm_packages/system.js'),
      entryJs: path.join(publicURL[0], assetInfo.main + (/\.js$/.test(assetInfo.main) ? '' : '.js'))
    }
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
  var assetDependenciesChanged

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
  debug('Update package.json')

  var jspmInfo = packageJSON.jspm || {}
  jspmInfo.directories = assetInfo.directories
  jspmInfo.dependencies = assetInfo.dependencies
  packageJSON.jspm = jspmInfo

  var pkgJSONStr = JSON.stringify(packageJSON, null, 2)
  fs.writeFileSync(path.join(packagePath, 'package.json'), pkgJSONStr)

  debug('run `jspm install` in path %s', packagePath)
  var childOpts = {
    stdio: [process.stdin, process.stdout, process.stderr]
  }

  var jspmBinPath = path.join(packagePath, '/node_modules/.bin/jspm')
  var child = child_process.spawn(jspmBinPath, ['install'], childOpts)
  child.on('exit', function(code) {
    next(0 === code ? undefined : code)
  }).on('error', next)
}

exports.mergeBundles = function(assetInfo, publicPath) {
  var bundles = assetInfo.bundles
  if (bundles) {
    debug('merge bundles to config.js:')
    var publicURL = assetInfo.publicURL[0]
    if (publicURL) {
      Object.keys(bundles).forEach(function(name) {
        debug(publicURL, name)
        var b = bundles[name]
        delete bundles[name]
        name = path.join(publicURL, name)
        bundles[name] = b
      })
    }
    debug(bundles)
  }

  return {
    assetbundles: bundles
  }
}

/**
 * MicroMono Asset private functions.
 */
var vm = require('vm')

function loadBundleInfo(publicPath) {
  var config = getConfigSync(publicPath)
  if (config && config.bundles) {
    debug('Bundle info:', config.bundles)
    return config.bundles
  }
}

function getConfigSync(publicPath) {
  var configPath = path.join(publicPath, 'config.js')
  var configCode = fs.readFileSync(configPath)

  var sandbox = {
    System: {
      config: function(cfg) {
        return cfg
      }
    },
    oldConfig: null
  }

  var script = new vm.Script('oldConfig = ' + configCode)
  script.runInNewContext(sandbox)

  return sandbox.oldConfig
}
