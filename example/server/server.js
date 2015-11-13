/**
 * Example of micromono server.
 */

// setup express app
var app = require('express')();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

// Get a micromono instance.
var micromono = require('micromono')();

// Boot the service(s) with express server
// do stuff in the promise callback.
micromono.startBalancer(app).then(function() {
  console.log('server booted');

  var assetInfo = micromono.asset.jspmInfo

  if (assetInfo.urls.bundleJs) {
    app.locals.mainBundleJs = assetInfo.urls.bundleJs
  }
  if (assetInfo.urls.bundleCss) {
    app.locals.mainBundleCss = assetInfo.urls.bundleCss
  }

  if (assetInfo.main) {
    app.locals.mainEntryJs = assetInfo.main
  }

  app.listen(3000);
});
