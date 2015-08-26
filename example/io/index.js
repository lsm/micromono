var MicroMono = require('micromono');
var micromono = new MicroMono();
var Service = MicroMono.Service;



var IO = module.exports = Service.extend({
  packagePath: __dirname,
  baseUrl: '/io',

  use: {
    // tell micromono to use `layout` middleware at the server side
    // for request url matching `/io/$`.
    'layout': '/$'
  },

  route: {
    '/': function(req, res) {
      res.render('index');
    }
  },

  init: function() {
    var baseUrl = this.baseUrl;
    var socketPath = '/example-socket';

    // listen to the `server` event
    this.on('server', function(server) {
      console.log('Please open http://127.0.0.1:3000/io in your browser.');
      // setup socket.io with server
      var io = require('socket.io')(server, {
        path: baseUrl + socketPath
      });

      io.on('connection', function(socket) {
        socket.on('message', function(msg) {
          console.log(new Date());
          console.log('client message: ', msg);
          socket.emit('message', msg);
        });
      });
    });

    // Tell micromono to allow websocket connection for this path.
    // The socketPath is a relative path to the baseUrl of the service.
    // The actuall path for client to connect will be: baseUrl + socketPath,
    // `/io/example-socket` in this case.
    // Please see `public/io/main.js` for example.
    this.allowUpgrade(socketPath);

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
