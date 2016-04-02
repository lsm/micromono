var fs = require('fs')
var path = require('path')
var jspm = require('./jspm')
var debug = require('debug')('micromono:asset:bundle')
var assign = require('lodash.assign')


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
  if (assetInfo.bundleDeps) {
    deps = deps.filter(function(dep) {
      return -1 === assetInfo.bundleDeps.indexOf(dep)
    })
  }

  if (assetInfo.ignoreDeps) {
    // Ignore service bundled deps.
    deps = deps.filter(function(dep) {
      return -1 === assetInfo.ignoreDeps.indexOf(dep)
    })
  }

  if (0 < deps.length)
    bundleCmd += deps.join(operator)

  if (assetInfo.bundleDeps && 0 < assetInfo.bundleDeps.length)
    // We should include the dependencies regardless the value of `bundleOptions.bundleDeps`
    bundleCmd += ' + ' + assetInfo.bundleDeps.join(' + ')

  if (assetInfo.ignoreDeps && 0 < assetInfo.ignoreDeps.length)
    // We should exclude the dependencies regardless the value of `bundleOptions.ignoreDeps`
    bundleCmd += ' - ' + assetInfo.ignoreDeps.join(' - ')

  bundleCmd = 'bundle ' + (entryFile ? [entryFile, operator].join('') : '') + bundleCmd

  var outFile = bundleOptions.outFile
  if ('/' !== outFile[0])
    outFile = path.join(publicPath, outFile)

  // override to make sure systemjs use the correct `outFile` path
  bundleOptions.outFile = outFile
  bundleCmd += exports.convertBundleOptionsToStr(bundleOptions)

  return {
    bundleCmd: bundleCmd,
    bundleOptions: bundleOptions
  }
}

exports.bundle = function(assetInfo, packagePath, jspmBinPath, bundleCmd, bundleOptions, setDep) {
  var publicURL = assetInfo.publicURL[0]
  jspm.runJSPM(packagePath, jspmBinPath, bundleCmd.split(' '), function(err) {
    if (err)
      return setDep('error', err)

    var outFileJs = bundleOptions.outFile
    debug('check output js file "%s"', outFileJs)
    fs.stat(outFileJs, function(err, stats) {
      if (stats && stats.isFile()) {
        debug('jspm js file bundled at: %s', outFileJs)
        assetInfo.bundleJs = path.join(publicURL, path.basename(outFileJs))
      } else {
        assetInfo.bundleJs = false
      }
      setDep('bundleJs', assetInfo.bundleJs)
    })

    var outFileCss = outFileJs.replace(/\.js$/, '.css')
    debug('check output css file "%s"', outFileCss)
    fs.stat(outFileCss, function(err, stats) {
      if (stats && stats.isFile()) {
        debug('jspm css file bundled at: %s', outFileCss)
        assetInfo.bundleCss = path.join(publicURL, path.basename(outFileCss))
      } else {
        assetInfo.bundleCss = false
      }
      setDep('bundleCss', assetInfo.bundleCss)
    })
  })
}

exports.bundleDevDependencies = function(assetInfo, publicPath, packagePath, jspmBinPath, setDep) {
  if (assetInfo.dependencies) {
    var main = assetInfo.main
    assetInfo.main = ''
    var bundleInfo = exports.prepareBundleInfo(assetInfo, publicPath, {
      bundleDeps: true,
      sourceMaps: false,
      sourceMapContents: false,
      minify: false,
      inject: false,
      buildCss: true,
      separateCss: true,
      outFile: 'bundle-' + assetInfo.name + '-dev-deps'
    })
    assetInfo.main = main
    bundleInfo.bundleCmd = bundleInfo.bundleCmd.replace(new RegExp(assetInfo.main + '\s\+'), '')
    debug('bundleInfo', bundleInfo)
    exports.bundle(assetInfo, packagePath, jspmBinPath, bundleInfo.bundleCmd, bundleInfo.bundleOptions, setDep)
  }
}

exports.convertBundleOptionsToStr = function convertBundleOptionsToStr(options) {
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
