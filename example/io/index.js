var MicroMono = require('micromono');
var micromono = new MicroMono();
var Service = MicroMono.Service;



var IO = module.exports = Service.extend({
  packagePath: __dirname,
  baseUrl: '/io',

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
    // Please see `view/index.jade` for example.
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
