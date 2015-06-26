/**
 * Example of service consumer server.
 */

// Get a micromono instance.
var micromono = require('micromono')();

// require the service & probe it from network.
micromono.require('provider');

// Boot the service(s) do stuff in the promise callback.
micromono.boot().then(function() {

  console.log('consumer booted');

  // Get the provider instance.
  var provider = micromono.services.provider;

  // Call remote api as it is local.
  provider.createPost({
    title: 'A blog post',
    content: 'And its great content.'
  }, function(err, result) {
    console.log(result);
  });
});
