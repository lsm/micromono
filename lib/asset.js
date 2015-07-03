/**
 * Client side assets management module for both provider and composer.
 */

/**
 * Module dependencies
 */

var fs = require('fs');
var path = require('path');
var jspm = require('jspm');
var assign = require('lodash.assign');
var express = require('express');
var serveStatic = require('serve-static');

/**
 * MicroMono Asset class constructor
 * @param  {String} [packagePath] Path to the package where package.json is located.
 */
var Asset = module.exports = function MicroMonoAsset(packagePath) {
  this.packagePath = packagePath;
  jspm.setPackagePath(packagePath);
};

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
    packagePath = packagePath || this.packagePath;
    var pjsonPath = path.join(packagePath, 'package.json');
    var pjson = require(pjsonPath);
    this.pkgInfo = pjson;

    if (pjson.jspm) {
      var jspmInfo = pjson.jspm;
      // Assign the package name to jspm object
      jspmInfo.name = pjson.name;
      jspmInfo.directories = jspmInfo.directories || {};
      this.jspmInfo = jspmInfo;

      // base url for generating other urls (e.g. config.js, system.js etc.)
      var publicURL = jspmInfo.directories ? (jspmInfo.directories.baseURL || '/') : '/';
      if (publicURL[0] !== '/') {
        publicURL = '/' + publicURL;
      }
      this.publicURL = publicURL;
      jspmInfo.publicURL = publicURL;
      this.publicPath = path.join(packagePath, publicURL);

      // relative urls of assets
      jspmInfo.urls = {
        configJS: path.join(publicURL, '/config.js'),
        systemJS: path.join(publicURL, '/jspm_packages/system.js'),
        entryJS: path.join(publicURL, jspmInfo.main + (/\.js$/.test(jspmInfo.main) ? '' : '.js'))
      };
    }

    return pjson.jspm;
  },

  mergeJSPMDeps: function(jspmInfo) {
    var _deps;
    var self = this;
    var depsToMerge = jspmInfo.dependencies;

    if (depsToMerge && Object.keys(depsToMerge).length > 0 && !this.jspmInfo) {
      this.jspmInfo = {
        directories: {
          baseURL: 'public'
        },
        dependencies: {}
      };
      this.needConfigJSPM = true;
    }

    _deps = this.jspmInfo.dependencies || {};

    Object.keys(depsToMerge).forEach(function(depName) {
      var oldDep = _deps[depName];
      var dep = depsToMerge[depName];
      if (!oldDep) {

        _deps[depName] = dep;
        self.needConfigJSPM = true;
      } else if (oldDep !== dep) {
        console.warn('You have potential conflicting dependencies: %s vs %s',
          oldDep, dep);
      }
    });

    if (Object.keys(_deps).length > 0) {
      this.jspmInfo.dependencies = _deps;
    }
  },

  configJSPM: function() {
    if (!this.pkgInfo || !this.needConfigJSPM) {
      return Promise.resolve();
    }

    var jspmInfo = this.jspmInfo;
    var _jspmInfo = this.pkgInfo.jspm || {};
    _jspmInfo.directories = assign(jspmInfo.directories, _jspmInfo.directories);
    _jspmInfo.dependencies = assign(jspmInfo.dependencies, _jspmInfo.dependencies);
    this.pkgInfo.jspm = _jspmInfo;

    var pkgInfoStr = JSON.stringify(this.pkgInfo);
    fs.writeFileSync(path.join(this.packagePath, 'package.json'), pkgInfoStr);
    this.parseJSPM();

    return jspm.install(true);
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
    var self = this;

    var jspmInfo = this.jspmInfo || this.parseJSPM(this.packagePath);

    if (!jspmInfo) {
      // Don't build bundle if there's no jspm info found
      return Promise.resolve();
    }

    options = options || {};
    var bundleCmd = jspmInfo.main;

    // ignore dependencies if `bundleDeps` is not true
    if (options.bundleDeps !== true) {
      var deps = jspmInfo.dependencies;
      deps = Object.keys(deps);
      if (deps.length > 0) {
        var ignoreDeps = '- ' + deps.join(' - ');
        bundleCmd += ' ' + ignoreDeps;
      }
    }

    // Prepare options for jspm/systemjs builder
    options.name = jspmInfo.name;
    options = getDefaultBundleOptions(options);
    var outFile = path.join(self.publicPath, options.outFile);

    // add entries info
    jspmInfo.urls.bundleJS = path.join(self.publicURL, options.outFile);
    jspmInfo.urls.bundleCSS = jspmInfo.urls.bundleJS.replace(/\.js$/, '.css');

    // override to make sure systemjs use the correct `outFile` path
    options.outFile = outFile;

    // set options for systemjs loader
    // this won't work when you run the builder for the first time
    // jspmConfig.loader.separateCSS = true;

    return jspm.bundle(bundleCmd, outFile, options).then(function() {
      console.log('jspm file built at: %s', outFile);
    });
  },

  /**
   * [startServer description]
   *
   * @param  {Number} port [description]
   * @param  {String} host [description]
   * @return {Promise}      [description]
   */
  startServer: function(port, host) {
    var app = express();
    this.express(app);
    this.jspmInfo.port = port;

    var promise = new Promise(function(resolve, reject) {
      app.listen(port, host, function(error) {
        error ? reject(error) : resolve();
      });
    });

    return promise;
  },

  express: function(app) {
    app.use(this.publicURL, serveStatic(this.publicPath));
  }
};

/**
 * MicroMono Asset private functions.
 */

function getDefaultBundleOptions(opts) {
  opts = opts || {};
  var _opts = {
    bundleDeps: false,
    outFile: (opts.name ? opts.name + '-' : '') + 'bundle.js',
    sourceMaps: 'inline',
    sourceMapContents: true,
    lowResSourceMaps: true,
    inject: false,
    minify: false,
    mangle: true
  };
  _opts = assign(_opts, opts);
  // make sure we have the `.js` suffix for outFile
  if (!/\.js$/.test(_opts.outFile)) {
    _opts.outFile += '.js';
  }
  return _opts;
}
