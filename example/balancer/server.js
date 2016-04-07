/**
 * Example of micromono server.
 */

// setup express app
var app = require('express')()
app.set('views', __dirname + '/views')
app.set('view engine', 'jade')

app.get('/balancer/exit', function(req, res) {
  res.send('ok')
  setTimeout(function() {
    process.exit(0)
  }, 1000)
})

// Get a micromono instance.
var micromono = require('/opt/micromono')
// process.env.NODE_ENV = 'xxx'
// micromono.set('bundle dev', undefined)


// Boot the service(s) with an express app
// do stuff in the callback.
micromono.startBalancer(app, function(balancerAsset) {
  console.log('server booted')

  var assetInfo = balancerAsset.assetInfo

  if (assetInfo.bundleJs) {
    app.locals.mainBundleJs = assetInfo.bundleJs
  }
  if (assetInfo.bundleCss) {
    app.locals.mainBundleCss = assetInfo.bundleCss
  }

  if (assetInfo.main) {
    app.locals.mainEntryJs = assetInfo.main
  }
})
