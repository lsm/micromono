/**
 * Client side assets management module for both balancer and service.
 */

/**
 * Module dependencies
 */

var fs = require('fs')
var path = require('path')
var jspm = require('jspm')
var debug = require('debug')('micromono:asset')
var assign = require('lodash.assign')
var isarray = require('lodash.isarray')
var child_process = require('child_process')

/**
 * MicroMono Asset class constructor
 * @param  {String} [packagePath] Path to the package where package.json is located.
 */
var Asset = module.exports = function MicroMonoAsset(packagePath) {
  if ('string' === typeof packagePath) {
    this.packagePath = packagePath
    jspm.setPackagePath(packagePath)
  } else if ('object' === typeof packagePath) {
    this.jspmInfo = packagePath
  }
}

/**
 * MicroMono Asset public API.
 */
Asset.prototype = {

  /**
   * Find and parse jspm information from package.json
   *
   * @param  {String} [packagePath] Path to the package where package.json is located.
   * @return {Object}  Information of JSPM
   */
  parseJSPM: function(packagePath) {
    packagePath = packagePath || this.packagePath
    var pjsonPath = path.join(packagePath, 'package.json')
    var pjson = require(pjsonPath)
    this.pkgInfo = pjson

    if (pjson.jspm) {
      var jspmInfo = pjson.jspm
      var micromonoInfo = pjson.micromono || {}
      this.jspmInfo = jspmInfo
      if (!jspmInfo.name) {
        // Assign the package name to jspm object
        jspmInfo.name = micromonoInfo.name || pjson.name
      }
      var directories = jspmInfo.directories || {}

      // base url for generating other urls (e.g. config.js, system.js etc.)
      if (!micromonoInfo.publicURL) {
        micromonoInfo.publicURL = path.join(directories.baseURL || '/', pjson.name)
      }
      var publicURL = micromonoInfo.publicURL || directories.baseURL || '/'
      var publicPath = directories.baseURL || '/'

      if (!isarray(publicURL)) {
        publicURL = [publicURL]
      }

      publicURL = publicURL.map(function(url) {
        if (url[0] !== '/') {
          url = '/' + url
        }
        return url
      })

      this.publicURL = publicURL
      jspmInfo.publicURL = publicURL
      this.publicPath = path.join(packagePath, publicPath)

      jspmInfo.main = jspmInfo.main || 'index.js'
      // relative urls of assets
      jspmInfo.urls = {
        configJS: path.join(publicURL[0], '/config.js'),
        systemJS: path.join(publicURL[0], '/jspm_packages/system.js'),
        entryJS: path.join(publicURL[0], jspmInfo.main + (/\.js$/.test(jspmInfo.main) ? '' : '.js'))
      }

      return jspmInfo
    }
  },

  getPublicURL: function() {
    return this.jspmInfo && this.jspmInfo.publicURL
  },

  getPublicPath: function() {
    return this.publicPath
  },

  mergeJSPMDeps: function(jspmInfo) {
    if (!jspmInfo || !jspmInfo.dependencies) {
      return
    }

    debug('merging jspm dependencies', jspmInfo.dependencies)

    var _deps
    var self = this
    var depsToMerge = jspmInfo.dependencies

    if (depsToMerge && Object.keys(depsToMerge).length > 0 && !this.jspmInfo) {
      this.jspmInfo = {
        directories: {
          baseURL: 'public'
        },
        dependencies: {}
      }
      this.needConfigJSPM = true
    }

    _deps = this.jspmInfo.dependencies || {}

    Object.keys(depsToMerge).forEach(function(depName) {
      var oldDep = _deps[depName]
      var dep = depsToMerge[depName]
      if (!oldDep) {
        _deps[depName] = dep
        self.needConfigJSPM = true
      } else if (oldDep !== dep) {
        debug('You have potential conflicting dependencies: %s vs %s', oldDep, dep)
      }
    })

    if (Object.keys(_deps).length > 0) {
      this.jspmInfo.dependencies = _deps
    }

    debug('need to configure jspm: %s', this.needConfigJSPM ? 'yes' : 'no')
  },

  configJSPM: function() {
    if (!this.pkgInfo || !this.needConfigJSPM) {
      return Promise.resolve()
    }

    debug('configuring jspm')

    var jspmInfo = this.jspmInfo
    var _jspmInfo = this.pkgInfo.jspm || {}
    _jspmInfo.directories = assign(jspmInfo.directories, _jspmInfo.directories)
    _jspmInfo.dependencies = assign(jspmInfo.dependencies, _jspmInfo.dependencies)
    this.pkgInfo.jspm = _jspmInfo

    var pkgInfoStr = JSON.stringify(this.pkgInfo, null, 2)
    fs.writeFileSync(path.join(this.packagePath, 'package.json'), pkgInfoStr)
    this.parseJSPM()

    if (this.packagePath) {
      debug('run `jspm install` in path %s', this.packagePath)
      var childOpts = {
        stdio: [process.stdin, process.stdout, process.stderr]
      }

      var jspmBinPath = path.join(this.packagePath, '/node_modules/.bin/jspm')
      var child = child_process.spawn(jspmBinPath, ['install'], childOpts)

      return new Promise(function(resolve, reject) {
        child.on('exit', resolve).on('error', reject)
      })
    } else {
      debug('asset has no `packagePath`, skip jspm install.')
      return Promise.resolve()
    }
  },

  /**
   * Bundle app code
   *
   * @param  {Object}   options for bundling assets
   * Default value for options:
   *         {
   *           bundleDeps: false,
   *           outFile: 'bundle' + ['-' + package name] + '.js',
   *           sourceMaps: 'inline',
   *           lowResSourceMaps: true,
   *           inject: false,
   *           minify: false,
   *           mangle: true,
   *           buildCss: true,
   *           separateCss: false
   *           // normalize
   *           // runtime
   *         }
   *
   * Default options when NODE_ENV is `production`:
   *         {
   *           bundleDeps: false,
   *           outFile: 'bundle' + ['-' + package name] + '.js',
   *           sourceMaps: 'inline',
   *           lowResSourceMaps: true,
   *           inject: false,
   *           minify: false,
   *           mangle: true,
   *           buildCss: true,
   *           separateCss: false
   *           // normalize
   *           // runtime
   *         }
   * @return {Promise}
   */
  bundle: function(options) {

    var self = this

    var jspmInfo = this.jspmInfo || this.parseJSPM(this.packagePath)

    if (!jspmInfo) {
      // Don't build bundle if there's no jspm info found
      return Promise.resolve()
    }

    options = options || {}
    var bundleCmd = path.join(this.getPublicPath(), jspmInfo.main)

    // ignore dependencies if `bundleDeps` is not true
    if (options.bundleDeps !== true) {
      var deps = jspmInfo.dependencies
      deps = Object.keys(deps)
      if (deps.length > 0) {
        var ignoreDeps = '- ' + deps.join(' - ')
        bundleCmd += ' ' + ignoreDeps
      }
    }

    // Prepare options for jspm/systemjs builder
    options.name = jspmInfo.name
    options = getDefaultBundleOptions(options)
    var outFile = options.outFile

    if ('/' !== outFile[0]) {
      outFile = path.join(self.publicPath, outFile)
    }

    // add entries info
    var publicURL = Array.isArray(this.publicURL) ? this.publicURL[0] : this.publicURL

    // override to make sure systemjs use the correct `outFile` path
    options.outFile = outFile

    // Set options for systemjs loader
    // Note: the systemjs loader need `CSS` upper case.
    var loader = jspm.Loader()
    loader.buildCSS = options.buildCss
    loader.separateCSS = options.separateCss

    debug('jspm bundle %s\n%s\nwith options:\n%s', bundleCmd, outFile, JSON.stringify(options, null, 2))
    return jspm.bundle(bundleCmd, outFile, options).then(function() {
      if (fs.statSync(outFile).isFile()) {
        jspmInfo.urls.bundleJS = path.join(publicURL, options.outFile)
        debug('jspm js file built at: %s', outFile)
      }

      var cssOutFile = outFile.replace(/\.js$/, '.css')
      if (fs.statSync(cssOutFile).isFile()) {
        jspmInfo.urls.bundleCSS = jspmInfo.urls.bundleJS.replace(/\.js$/, '.css')
        debug('jspm css file built at: %s', cssOutFile)
      }
    }).catch(function(e) {
      debug('asset bundle error', e);
    })
  }
}

/**
 * MicroMono Asset private functions.
 */

function getDefaultBundleOptions(opts) {
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

  // Set default options for production.
  if ('production' === process.env.NODE_ENV) {
    _opts.sourceMaps = false
    _opts.sourceMapContents = false
    _opts.lowResSourceMaps = false
    _opts.inject = true
    _opts.minify = true
    _opts.mangle = true
    _opts.buildCss = false
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
