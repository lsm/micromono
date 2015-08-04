/**
 * Example of micromono server.
 */

// setup express app
var app = require('express')();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

// Get a micromono instance.
var micromono = require('micromono')();

// require services, find it locally or probe it from network.
micromono.require('home');
var Account = micromono.require('account');
var account = new Account();
account.x = 'server';

// Boot the service(s) with express server
// do stuff in the promise callback.
micromono.boot(app).then(function() {
  console.log('server booted');

  app.listen(3000);
});
