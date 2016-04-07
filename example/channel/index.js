var micromono = require('/opt/micromono')
var socketmq = require('socketmq')

var IO = module.exports = {
  upgradeUrl: '/channel/socket',

  channel: {
    namespace: '/filetree',
    auth: function(req, next) {
      console.log(req.headers)
      next(null, true)
    },

    join: function(type, topic) {
      // type could be `sub` or `rep`
      // topic could be any string
    },

    leave: function() {},

    'sub::hello from channel': function(msg) {}
  },

  use: {
    // Tell micromono to use `layout` middleware at the balancer side
    // for request url matching `/channel$`.
    'layout': '/channel$'
  },

  route: {
    '/channel': function(req, res) {
      res.render('index')
    },
    '/channel/exit': function(req, res) {
      res.send('ok')
      setTimeout(function() {
        process.exit(0)
      }, 1000)
    }
  },

  init: function(app, httpServer) {
    var socketPath = IO.upgradeUrl
    console.log('socketmq path', socketPath)

    // Tell socketmq use engine.io
    var endpoint = 'eio://'

    var smq = socketmq.bind(endpoint, {
      path: socketPath,
      httpServer: httpServer,
      allowRequest: function(req, callback) {
        console.log('allowRequest')
        console.log(req.headers)
        callback(null, true)
      }
    })

    smq.sub('hello channel', function(msg) {
      console.log('server got message:', msg.toString())
    })

    setInterval(function() {
      smq.pub('from server', 'hello client')
    }, 1000)

    // setup express app
    app.set('views', __dirname + '/view')
    app.set('view engine', 'jade')
  }
}


// Start the service if this is the main file
if (require.main === module) {
  micromono.startService(IO, function(httpPort) {
    console.log('local http port: %s', httpPort)
  }, ['httpPort'])
}
