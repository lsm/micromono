/**
 * Client side assets management module for both balancer and service.
 */

/**
 * Module dependencies
 */

var fs = require('fs')
var vm = require('vm')
var path = require('path')
var jspm = require('jspm')
var debug = require('debug')('micromono:web:asset')
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
    // require('jspm/lib/config').loaded = false
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

      if (micromonoInfo.bundleDeps) {
        jspmInfo.bundleDeps = micromonoInfo.bundleDeps
      }

      if (micromonoInfo.ignoreDeps) {
        jspmInfo.ignoreDeps = micromonoInfo.ignoreDeps
      }

      // Expose bundle info
      jspmInfo.bundles = loadBundleInfo(this.getPublicPath())

      // relative urls of assets
      jspmInfo.urls = {
        configJs: path.join(publicURL[0], '/config.js'),
        systemJs: path.join(publicURL[0], '/jspm_packages/system.js'),
        entryJs: path.join(publicURL[0], jspmInfo.main + (/\.js$/.test(jspmInfo.main) ? '' : '.js'))
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

    // Ignore deps bundled by services.
    var bundleDeps = jspmInfo.bundleDeps || []
    if (!this.jspmInfo.ignoreDeps) {
      this.jspmInfo.ignoreDeps = []
    }
    this.jspmInfo.ignoreDeps = this.jspmInfo.ignoreDeps.concat(bundleDeps)

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

    var bundles = jspmInfo.bundles
    if (bundles) {
      debug('merge bundles to config.js:')
      var publicURL = jspmInfo.publicURL[0]
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
      writeConfigSync(this.getPublicPath(), {
        bundles: bundles
      })
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
   *         }
   *
   * Default options when NODE_ENV is `production`:
   *         {
   *           bundleDeps: false,
   *           outFile: 'bundle' + ['-' + package name] + '.js',
   *           sourceMaps: false,
   *           sourceMapContents: false,
   *           lowResSourceMaps: true,
   *           inject: true,
   *           minify: true,
   *           mangle: true,
   *           buildCss: true,
   *           separateCss: true
   *         }
   *
   * @param {String} [env] A pre-set default options. Now only support `production`.
   * @return {Promise}
   */
  bundle: function(options, env) {
    var self = this
    var jspmInfo = this.jspmInfo || this.parseJSPM(this.packagePath)

    if (!jspmInfo) {
      // Don't build bundle if there's no jspm info found
      return Promise.resolve()
    }

    options = options || {}
    // Prepare options for jspm/systemjs builder
    options.name = jspmInfo.name
    options = getDefaultBundleOptions(options, env)

    var entryFile = jspmInfo.main
    var bundleCmd = ''

    // ignore or include dependencies
    var operator = options.bundleDeps === true ? ' + ' : ' - '
    var deps = jspmInfo.dependencies
    deps = Object.keys(deps)

    if (jspmInfo.bundleDeps) {
      deps = deps.filter(function(dep) {
        return -1 === jspmInfo.bundleDeps.indexOf(dep)
      })
    }

    if (jspmInfo.ignoreDeps) {
      // Ignore service bundled deps.
      deps = deps.filter(function(dep) {
        return -1 === jspmInfo.ignoreDeps.indexOf(dep)
      })
    }

    if (deps.length > 0) {
      bundleCmd += operator + deps.join(operator)
    }

    if (jspmInfo.bundleDeps) {
      // We should include the dependencies regardless the value of `options.bundleDeps`
      bundleCmd += ' + ' + jspmInfo.bundleDeps.join(' + ')
    }

    if (jspmInfo.ignoreDeps) {
      // We should exclude the dependencies regardless the value of `options.ignoreDeps`
      bundleCmd += ' - ' + jspmInfo.ignoreDeps.join(' - ')
    }

    bundleCmd = 'bundle ' + entryFile + bundleCmd

    var outFile = options.outFile
    if ('/' !== outFile[0]) {
      outFile = path.join(self.publicPath, outFile)
    }

    // add entries info
    var publicURL = Array.isArray(this.publicURL) ? this.publicURL[0] : this.publicURL

    // override to make sure systemjs use the correct `outFile` path
    options.outFile = outFile

    bundleCmd += convertBundleOptionsToStr(options)

    // Set options for systemjs loader
    writeConfigSync(this.getPublicPath(), options)

    debug('jspm %s\n%s\nwith options:\n%s',
      bundleCmd, outFile, JSON.stringify(options, null, 2))

    var jspmBinPath = path.join(this.packagePath, '/node_modules/.bin/jspm')
    var child = child_process.spawn(jspmBinPath, bundleCmd.split(' '), {
      cwd: this.packagePath
    })

    child.stderr.on('data', function(chunk) {
      debug(chunk.toString())
    })
    child.stdout.on('data', function(chunk) {
      debug(chunk.toString())
    })

    return new Promise(function(resolve, reject) {
      child.on('exit', resolve).on('error', reject)
    }).then(function() {
      try {
        if (fs.statSync(outFile).isFile()) {
          debug('jspm js file bundled at: %s', outFile)
          jspmInfo.urls.bundleJs = path.join(publicURL, path.basename(outFile))
        }
      } catch (e) {
        debug('No js file bundled at: %s', outFile)
      }
      try {
        var cssOutFile = outFile.replace(/\.js$/, '.css')
        if (fs.statSync(cssOutFile).isFile()) {
          debug('jspm css file bundled at: %s', cssOutFile)
          jspmInfo.urls.bundleCss = path.join(publicURL,
            path.basename(outFile.replace(/\.js$/, '.css')))
        }
      } catch (e) {
        debug('No css file bundled at: %s', cssOutFile)
      }

      // Reload bundle info
      jspmInfo.bundles = loadBundleInfo(self.getPublicPath())

    }).catch(function(e) {
      debug('asset bundle error', e.stack || e.message)
    })
  }
}

/**
 * MicroMono Asset private functions.
 */

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

function writeConfigSync(publicPath, options) {
  var configPath = path.join(publicPath, 'config.js')
  var config = getConfigSync(publicPath)
  if (config) {
    debug('update jspm config file: %s', configPath)

    // Note: the systemjs loader need `CSS` upper case.
    if (options.hasOwnProperty('buildCss')) {
      config.buildCSS = options.buildCss || false
    }

    if (options.hasOwnProperty('separateCss')) {
      config.separateCSS = options.separateCss || false
    }

    if (options.bundles) {
      config.bundles = assign(config.bundles, options.bundles)
    }

    fs.writeFileSync(configPath, 'System.config(' + JSON.stringify(config, null, 2) + ');')
  }
}

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

  if (!options.sourceMaps) {
    str += ' --skip-source-maps'
  }
  if (options.sourceMapContents) {
    str += ' --source-map-contents'
  }
  if (options.inject) {
    str += ' --inject'
  }
  if (options.minify) {
    str += ' --minify'
  }
  if (!options.mangle) {
    str += ' --no-mangle'
  }

  return str
}
