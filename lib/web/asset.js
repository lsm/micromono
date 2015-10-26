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
      // Assign the package name to jspm object
      jspmInfo.name = pjson.name
      var directories = jspmInfo.directories || {}

      // base url for generating other urls (e.g. config.js, system.js etc.)
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
   *           outFile: package name + '-' + 'bundle.js',
   *           sourceMaps: 'inline',
   *           lowResSourceMaps: true,
   *           inject: false,
   *           minify: false,
   *           mangle: true,
   *           // normalize
   *           // runtime
   *           // @todo how to override loader settings: buildCSS, separateCSS
   *         }
   *
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
    var bundleCmd = jspmInfo.main

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
    var outFile = path.join(self.publicPath, options.outFile)

    // add entries info
    jspmInfo.urls.bundleJS = path.join(self.publicURL, options.outFile)
    jspmInfo.urls.bundleCSS = jspmInfo.urls.bundleJS.replace(/\.js$/, '.css')

    // override to make sure systemjs use the correct `outFile` path
    options.outFile = outFile

    // set options for systemjs loader
    // this won't work when you run the builder for the first time
    // jspmConfig.loader.separateCSS = true

    return jspm.bundle(bundleCmd, outFile, options).then(function() {
      console.log('jspm file built at: %s', outFile)
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
    outFile: (opts.name ? opts.name + '-' : '') + 'bundle.js',
    sourceMaps: 'inline',
    sourceMapContents: true,
    lowResSourceMaps: true,
    inject: false,
    minify: false,
    mangle: true
  }
  _opts = assign(_opts, opts)
  // make sure we have the `.js` suffix for outFile
  if (!/\.js$/.test(_opts.outFile)) {
    _opts.outFile += '.js'
  }
  return _opts
}
