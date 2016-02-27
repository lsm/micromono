var fs = require('fs')
var vm = require('vm')
var path = require('path')
var debug = require('debug')('micromono:asset:jspm')
var spawn = require('child_process').spawn
var assign = require('lodash.assign')


exports.getJSPMConfig = function(publicPath, next) {
  var configPath = path.join(publicPath, 'config.js')
  fs.readFile(configPath, 'utf8', function(err, configCode) {
    if (err || !configCode) {
      next.setDep('jspmConfig', null)
      return next(err)
    }

    var sandbox = {
      System: {
        config: function(cfg) {
          return cfg
        }
      },
      config: null
    }
    var script = new vm.Script('config = ' + configCode)
    script.runInNewContext(sandbox)
    next.setDep('jspmConfig', sandbox.config)
    next()
  })
}

exports.prefixJSPMBundles = function(assetInfo) {
  var bundles = assetInfo.bundles

  if (bundles) {
    debug('prefix bundle URLs with publicURL:')
    var publicURL = assetInfo.publicURL[0]
    if (publicURL)
      Object.keys(bundles).forEach(function(name) {
        debug(publicURL, name)
        var b = bundles[name]
        delete bundles[name]
        name = path.join(publicURL, name)
        bundles[name] = b
      })
    debug('prefixed bundles', bundles)
  }

  return {
    assetBundles: bundles
  }
}

exports.updateJSPMConfig = function(publicPath, jspmConfig, updateOpts, next) {
  var configPath = path.join(publicPath, 'config.js')
  debug('update jspm config file: %s', configPath)

  // Note: the systemjs loader need `CSS` upper case.
  if (updateOpts.hasOwnProperty('buildCss'))
    jspmConfig.buildCSS = updateOpts.buildCss || false

  if (updateOpts.hasOwnProperty('separateCss'))
    jspmConfig.separateCSS = updateOpts.separateCss || false

  if (updateOpts.bundles)
    jspmConfig.bundles = assign(jspmConfig.bundles, updateOpts.bundles)

  fs.writeFile(configPath, 'System.config(' + JSON.stringify(jspmConfig, null, 2) + ');', next)
}

exports.runJSPM = function(packagePath, spwanArgs, next) {
  debug('run `jspm install` in path %s with args %s', packagePath, spwanArgs)

  var childOpts = {
    cwd: packagePath,
    stdio: [process.stdin, process.stdout, process.stderr]
  }

  var jspmBinPath = path.join(packagePath, '/node_modules/.bin/jspm')
  var child = spawn(jspmBinPath, spwanArgs, childOpts)
  child.on('exit', function(code) {
    next(0 === code ? undefined : code)
  }).on('error', next)

  return child
}
