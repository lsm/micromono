var micromono = require('/opt/micromono')
// var account = micromono.require('account')

var IO = module.exports = {
  channel: {
    namespace: '/example/channel',
    auth: function(meta, next) {
      console.log('auth', meta)
      var cookie = meta.cookie
      var session = meta.session
      if (session && 'string' === typeof session) {
        session = JSON.parse(session)
        // Dencrypt session
        next(null, 'session', session)
      } else if (cookie) {
        // Auth client
        session = {
          uid: 1,
          sid: meta.sid
        }
        // Encrypt
        next(null, {
          ssn: JSON.stringify(session),
          session: session
        })
      }
    },

    join: function(session, channel, next) {
      console.log('join', session, channel)
      next(null, {
        repEvents: ['hello:message', 'hello:reply'],
        subEvents: ['server:message']
      })
    },

    allow: function(session, channel, event, next) {
      console.log('allow', session, channel, event)
      next()
    },

    'hello:message': function(session, channel, msg) {
      console.log('hello:message', session, channel, msg)
      this.pubChn(channel, 'server:message', 'hello from server')
      if (!this['chn' + session.sid]) {
        this['chn' + session.sid] = this.chnAdapter.channel('/example/channel', channel)
      }

      this['chn' + session.sid].pubSid(session.sid, 'server:message', msg + ' for sid: ' + session.sid)
    },

    'readFile': function(session, channel, filename, reply) {
      throw new Error('No one should be able to reach here.')
    },
    'hello:reply': function(session, channel, msg, reply) {
      console.log('hello:reply', session, channel, msg);
      reply(null, 'Hi, how are you user ' + session.uid)
    }
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

  init: [function(app, chnAdapter) {
    // setup express app
    app.set('views', __dirname + '/view')
    app.set('view engine', 'jade')
    this.chnAdapter = chnAdapter
  }, ['app', 'chnAdapter']]
}


// Start the service if this is the main file
if (require.main === module) {
  micromono.startService(IO, function(httpPort) {
    console.log('local http port: %s', httpPort)
  }, ['httpPort'])
}
