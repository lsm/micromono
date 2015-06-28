/**
 * Example of service consumer server.
 */

// Get a micromono instance.
var micromono = require('micromono')();

// require the service & probe it from network.
var Provider = micromono.require('provider');


var p1 = new Provider();

// Boot the service(s) do stuff in the promise callback.
micromono.boot().then(function() {

  console.log('consumer booted');

  // Get the provider instance.
  var provider = micromono.services.provider;

  // Service class required from micromono is a singleton factory
  var p2 = new Provider();
  console.log(p1 === p2 && p2 === provider);
  // Call remote api as it is local.
  provider.createPost({
    title: 'A blog post',
    content: 'And its great content.'
  }, function(err, result) {
    console.log(result);
  });
});
