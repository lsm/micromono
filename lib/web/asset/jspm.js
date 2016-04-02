var fs = require('fs')
var vm = require('vm')
var path = require('path')
var debug = require('debug')('micromono:asset:jspm')
var spawn = require('child_process').spawn
var assign = require('lodash.assign')


exports.getJSPMConfig = function(assetInfo, publicPath, setDep) {
  var configPath = path.join(publicPath, 'config.js')
  debug('get jspm config from %s', configPath)
  fs.readFile(configPath, 'utf8', function(err, configCode) {
    if (err || !configCode) {
      setDep({
        error: 'err',
        jspmConfig: null,
        jspmConfigPath: configPath
      })
      return
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
    var jspmConfig = sandbox.config
    if (jspmConfig)
      assetInfo.bundles = jspmConfig && jspmConfig.bundles
    setDep({
      jspmConfig: jspmConfig,
      jspmConfigPath: configPath
    })
  })
}

exports.prefixJSPMBundles = function(assetInfo) {
  var bundles = assetInfo.bundles

  if (bundles) {
    debug('prefix bundle URLs with publicURL:')
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
    debug('prefixed bundles', bundles)
  }

  return {
    assetBundles: bundles
  }
}

exports.updateJSPMConfig = function(jspmConfigPath, jspmConfig, updateOpts, next) {
  debug('update jspm config file: %s', jspmConfigPath)

  // In case we just need to rewrite the config.js with consistent double quotes.
  updateOpts = updateOpts || {}

  // Note: the systemjs loader need `CSS` upper case.
  if (updateOpts.hasOwnProperty('buildCss'))
    jspmConfig.buildCSS = updateOpts.buildCss || false

  if (updateOpts.hasOwnProperty('separateCss'))
    jspmConfig.separateCSS = updateOpts.separateCss || false

  if (updateOpts.bundles)
    jspmConfig.bundles = assign(jspmConfig.bundles, updateOpts.bundles)

  fs.writeFile(jspmConfigPath, 'System.config(' + JSON.stringify(jspmConfig, null, 2) + ');', next)
}

exports.getJSPMBinPath = function(packagePath) {
  var locations = [
    // From service/node_modules
    path.join(packagePath, '/node_modules/.bin/jspm'),
    // From micromono/node_modules
    path.join(__dirname, '../../../', '/node_modules/.bin/jspm'),
    // From ../node_modules
    path.join(__dirname, '../../../../', '/.bin/jspm')
  ]

  var jspmBinPath

  locations.some(function(p) {
    if (isExecutable(p)) {
      jspmBinPath = p
      return true
    }
  })

  if (!jspmBinPath)
    debug('Using global `jspm`. Can not be found locally:', locations)

  return {
    jspmBinPath: jspmBinPath || 'jspm'
  }
}

exports.runJSPM = function(packagePath, jspmBinPath, spwanArgs, next) {
  debug('run `jspm` from "%s" in path "%s" with args [%s]', jspmBinPath, packagePath, spwanArgs)

  var childOpts = {
    cwd: packagePath,
    stdio: [process.stdin, process.stdout, process.stderr]
  }
  var child = spawn(jspmBinPath, spwanArgs, childOpts)
  child.on('exit', function(code) {
    next(0 === code ? undefined : code)
  }).on('error', next)
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath)
    return true
  } catch (e) {
    return false
  }
}
