var micromono = require('/opt/micromono')
var channelA = require('./channel-a')
var channelB = require('./channel-b')

var IO = module.exports = {
  // Multiple channels
  channel: {
    '/channel/a': channelA,
    '/channel/b': channelB
  },

  // Single channel
  // channel: channelA,

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

  init: [function(app, chnBackend) {
    // setup express app
    app.set('views', __dirname + '/view')
    app.set('view engine', 'jade')
  }, ['app', 'chnBackend']]
}


// Start the service if this is the main file
if (require.main === module) {
  micromono.startService(IO, function(httpPort) {
    console.log('local http port: %s', httpPort)
  }, ['httpPort'])
}
