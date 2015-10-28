var MicroMono = require('micromono');
var micromono = new MicroMono();
var Service = MicroMono.Service;



var IO = module.exports = Service.extend({
  packagePath: __dirname,

  // Base relative url for all routes and sockets
  baseUrl: '/io',
  // Tell micromono to allow upgrade (websocket) connection for this path.
  // The upgradeUrl is a relative path to the baseUrl of the service.
  // The actuall path for client to connect will be: baseUrl + upgradeUrl,
  // `/io/example-socket` in this case.
  // Please see `public/io/main.js` for example.
  upgradeUrl: '/example-socket',

  use: {
    // Tell micromono to use `layout` middleware at the balancer side
    // for request url matching `/io/$`.
    'layout': '/$'
  },

  route: {
    '/': function(req, res) {
      res.render('index');
    }
  },

  init: function() {
    // Calling `allowUpgrade` with no arguments will return
    // the full url (baseUrl + upgradeUrl) which accepts upgrade request
    var socketPath = this.allowUpgrade();
    console.log('socket.io path', socketPath);
    // You can override the above defined `upgradeUrl` by calling `allowUpgrade`
    // with new url string you want
    // this.allowUpgrade('/my/new-socket');

    // listen to the `server` event
    this.on('server', function(server) {
      console.log('Please open http://127.0.0.1:3000/io in your browser.');
      // setup socket.io with server
      var io = require('socket.io')(server, {
        path: socketPath
      });

      io.on('connection', function(socket) {
        socket.on('message', function(msg) {
          console.log(new Date());
          console.log('client message: ', msg);
          socket.emit('message', msg);
        });
      });
    });

    // setup express app
    var app = this.app;
    app.set('views', __dirname + '/view');
    app.set('view engine', 'jade');
  }
});


// Start the service if this is the main file
if (require.main === module) {
  micromono.startService(IO);
}
