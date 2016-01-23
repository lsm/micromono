var micromono = require('micromono')


var IO = module.exports = {
  upgradeUrl: '/io/example-socket',

  use: {
    // Tell micromono to use `layout` middleware at the balancer side
    // for request url matching `/io$`.
    'layout': '/io$'
  },

  route: {
    '/io': function(req, res) {
      res.render('index')
    }
  },

  init: function(app, httpServer) {
    var socketPath = IO.upgradeUrl
    console.log('socket.io path', socketPath)

    // listen to the `server` event
    console.log('Please open http://127.0.0.1:3000/io in your browser (no trailing slash).')
    // setup socket.io with server
    var io = require('socket.io')(httpServer, {
      path: socketPath
    })

    io.on('connection', function(socket) {
      socket.on('message', function(msg) {
        console.log(new Date())
        console.log('client message: ', msg)
        socket.emit('message', msg)
      })
    })

    // setup express app
    app.set('views', __dirname + '/view')
    app.set('view engine', 'jade')
  }
}


// Start the service if this is the main file
if (require.main === module) {
  micromono.startService(IO)
}
