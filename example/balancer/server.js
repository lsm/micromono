/**
 * Example of micromono server.
 */

// setup express app
var app = require('express')()
app.set('views', __dirname + '/views')
app.set('view engine', 'jade')

// Get a micromono instance.
var micromono = require('micromono')

// Boot the service(s) with an express app
// do stuff in the callback.
micromono.startBalancer(app, function(balancerAsset) {
  console.log('server booted')

  var assetInfo = balancerAsset.assetInfo

  if (assetInfo.urls.bundleJs) {
    app.locals.mainBundleJs = assetInfo.urls.bundleJs
  }
  if (assetInfo.urls.bundleCss) {
    app.locals.mainBundleCss = assetInfo.urls.bundleCss
  }

  if (assetInfo.main) {
    app.locals.mainEntryJs = assetInfo.main
  }
})
