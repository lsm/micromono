/**
 * Client side assets management module for both provider and composer.
 */

/**
 * Module dependencies
 */
var path = require('path');
var jspm = require('jspm');
var jspmConfig = require('jspm/lib/config');
var assign = require('lodash.assign');
var express = require('express');
var serveStatic = require('serve-static');

/**
 * Module exports
 * @param {Function}
 */
module.exports = Asset;

/**
 * Constructor function for Asset module
 */
function Asset(packagePath) {
  this.packagePath = packagePath;
  jspm.setPackagePath(packagePath);
}

Asset.prototype = {

  /**
   * Find and parse jspm information from package.json
   *
   * @param  {String} packagePath Path to the package where package.json is located.
   * @return {Promise}
   */
  parseJSPM: function(packagePath) {
    var pjsonPath = path.join(packagePath, 'package.json');
    var pjson = require(pjsonPath);
    // load config only if we found `jspm` in `package.json`
    if (pjson.jspm) {
      var self = this;
      return jspmConfig.load().then(function() {
        var jspmInfo = pjson.jspm;
        // Assign the package name to jspm object
        jspmInfo.name = pjson.name;
        jspmInfo.directories = jspmInfo.directories || {};
        self.jspmInfo = jspmInfo;
        // figure out the public path for asset files
        if (jspmInfo.directories.lib) {
          self.publicPath = path.join(packagePath, jspmInfo.directories.lib);
        } else {
          self.publicPath = packagePath;
        }
        // base url for generating other urls (e.g. config.js, system.js etc.)
        var publicURL = jspmInfo.directories.baseURL || '/';
        if (publicURL[0] !== '/') {
          publicURL = '/' + publicURL;
        }
        self.publicURL = publicURL;
        // relative urls of assets
        jspmInfo.urls = {
          configJS: path.join(publicURL, '/config.js'),
          systemJS: path.join(publicURL, '/jspm_packages/system.js'),
          entryJS: path.join(publicURL, jspmInfo.main + (/\.js$/.test(jspmInfo.main) ? '' : '.js'))
        };
      });
    } else {
      var err = new Error('Property `jspm` has not been found in package.json. No asset will be built.');
      return Promise.reject(err);
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
    var self = this;
    return this.parseJSPM(this.packagePath).then(function() {
      options = options || {};

      var jspmInfo = self.jspmInfo;
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
    }, function(error) {
      console.warn(error);
    });
  },

  startAssetServer: function(port, host) {
    var app = express();
    app.use(this.publicURL, serveStatic(this.publicPath));
    app.listen(port, host);
  }
};

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


function mergeDependencies(deps) {
  var jspmDeps = this.jspmDeps;

  Object.keys(deps).forEach(function(depName) {
    var oldDep = jspmDeps[depName];
    var dep = deps[depName];
    if (!oldDep) {
      jspmDeps[depName] = dep;
    } else if (oldDep !== dep) {
      console.warn('You have potential conflicting dependencies: %s vs %s',
        oldDep, dep);
    }
  });
}
