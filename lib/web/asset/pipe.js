var fs = require('fs')
var path = require('path')
var jspm = require('./jspm')
var union = require('lodash.union')
var debug = require('debug')('micromono:asset:pipe')
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

exports.mergeBundles = function(assetInfo, jspmInfo, publicPath, next) {
  var bundles = assetInfo.bundles

  if (bundles) {
    debug('merge bundles to config.js:')
    var publicURL = assetInfo.publicURL[0]
    if (publicURL)
      Object.keys(bundles).forEach(function(name) {
        debug(publicURL, name)
        var b = bundles[name]
        delete bundles[name]
        name = path.join(publicURL, name)
        bundles[name] = b
      })

    debug(bundles)
    jspm.updateJSPMConfig(publicPath, jspmInfo, {
      bundles: bundles
    }, next)
  } else {
    next()
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



exports.prepareBundleInfo = function(assetInfo, publicPath, bundleOptions) {
  // Prepare bundleOptions for jspm/systemjs builder
  bundleOptions.name = assetInfo.name
  bundleOptions = getDefaultBundleOptions(bundleOptions)

  var entryFile = assetInfo.main
  var bundleCmd = ''

  // ignore or include dependencies
  var operator = true === bundleOptions.bundleDeps ? ' + ' : ' - '
  var deps = assetInfo.dependencies
  deps = Object.keys(deps)

  // First we filter all dependencies found in `bundleDeps` and `ignoreDeps` in
  // assetInfo. Then add them back with correct operator accordingly.
  if (assetInfo.bundleDeps)
    deps = deps.filter(function(dep) {
      return -1 === assetInfo.bundleDeps.indexOf(dep)
    })
  if (assetInfo.ignoreDeps)
    // Ignore service bundled deps.
    deps = deps.filter(function(dep) {
      return -1 === assetInfo.ignoreDeps.indexOf(dep)
    })

  if (0 < deps.length)
    bundleCmd += operator + deps.join(operator)

  if (assetInfo.bundleDeps)
    // We should include the dependencies regardless the value of `bundleOptions.bundleDeps`
    bundleCmd += ' + ' + assetInfo.bundleDeps.join(' + ')

  if (assetInfo.ignoreDeps)
    // We should exclude the dependencies regardless the value of `bundleOptions.ignoreDeps`
    bundleCmd += ' - ' + assetInfo.ignoreDeps.join(' - ')

  bundleCmd = 'bundle ' + entryFile + bundleCmd

  var outFile = bundleOptions.outFile
  if ('/' !== outFile[0])
    outFile = path.join(publicPath, outFile)

  // override to make sure systemjs use the correct `outFile` path
  bundleOptions.outFile = outFile
  bundleCmd += convertBundleOptionsToStr(bundleOptions)

  return {
    bundleCmd: bundleCmd,
    bundleOptions: bundleOptions
  }
}

exports.bundle = function(assetInfo, packagePath, bundleCmd, bundleOptions, next) {
  var publicURL = assetInfo.publicURL[0]
  var child = jspm.runJSPM(packagePath, bundleCmd.split(' '), function(err) {
    if (err)
      return next(err)

    var count = 0
    var outFileJs = bundleOptions.outFile
    fs.stat(outFileJs, function(err, stats) {
      if (stats.isFile()) {
        debug('jspm js file bundled at: %s', outFileJs)
        assetInfo.bundleJs = path.join(publicURL, path.basename(outFileJs))
      }
      if (2 === ++count)
        next()
    })

    var outFileCss = outFileJs.replace(/\.js$/, '.css')
    fs.stat(outFileCss, function(err, stats) {
      if (stats.isFile()) {
        debug('jspm css file bundled at: %s', outFileCss)
        assetInfo.bundleCss = path.join(publicURL, path.basename(outFileCss))
      }
      if (2 === ++count)
        next()
    })
  })
  child.stderr.on('data', function(chunk) {
    debug('jspm stderr: ', chunk.toString())
  })
  child.stdout.on('data', function(chunk) {
    debug('jspm stdout: ', chunk.toString())
  })

// Make sure to reload bundle info from jspm config.js in next pipes using
// `getJSPMConfig`
}

/**
 * Private functions
 */

function getDefaultBundleOptions(opts, env) {
  opts = opts || {}
  var _opts = {
    bundleDeps: false,
    outFile: 'bundle' + (opts.name ? '-' + opts.name : '') + '.js',
    sourceMaps: 'inline',
    sourceMapContents: true,
    lowResSourceMaps: true,
    inject: false,
    minify: false,
    mangle: false,
    buildCss: true,
    separateCss: false
  }

  env = env || process.env.NODE_ENV
  // Set default options for production.
  if ('production' === env) {
    _opts.bundleDeps = true
    _opts.sourceMaps = false
    _opts.sourceMapContents = false
    _opts.lowResSourceMaps = false
    _opts.inject = true
    _opts.minify = true
    _opts.mangle = true
    _opts.buildCss = true
    _opts.separateCss = true
  }

  _opts = assign(_opts, opts)
  // make sure we have the `.js` suffix for outFile
  var ext = path.extname(_opts.outFile)
  if (!ext) {
    _opts.outFile += '.js'
  } else if ('.js' !== ext) {
    // Replace it with the .js suffix. e.g. `.jsx`.
    _opts.outFile = _opts.outFile.slice(0, -ext.length) + '.js'
  }
  return _opts
}

function convertBundleOptionsToStr(options) {
  var str = ' ' + options.outFile

  if (!options.sourceMaps)
    str += ' --skip-source-maps'
  if (options.sourceMapContents)
    str += ' --source-map-contents'
  if (options.inject)
    str += ' --inject'
  if (options.minify)
    str += ' --minify'
  if (!options.mangle)
    str += ' --no-mangle'

  return str
}
