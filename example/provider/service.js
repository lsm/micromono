/**
 * Example service provider server.
 */

// Get a micromono instance.
var micromono = require('micromono')();

// Load the service provider class from local storage.
micromono.require(__dirname);

// Boot the provider service and start broadcasting service info to network.
micromono.boot().then(function() {
  console.log('booted');
});
