var util = require('util')

module.exports = {
  auth: function(meta, next) {
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
    console.log('join b', session, channel)
    next(null, {
      repEvents: ['hello:message', 'hello:reply'],
      subEvents: ['server:message']
    })
  },

  allow: function(session, channel, event, next) {
    console.log('allow /channel/b', channel, event);
    next()
  },

  'hello:message': function(session, channel, msg) {
    this
      .getChannel('/channel/b')
      .pubChn(channel,
        'server:message',
        'message for everyone in namespace "/channel/b" channel ' + channel)

    var message = util.format('sid: %s<br />namespace: %s<br />channel:%s<br />',
      session.sid, '/channel/b', channel)
    this.chnBackend.channel('/channel/b', channel).pubSid(session.sid, 'server:message', message)
  },

  'readFile': function(session, channel, filename, reply) {
    throw new Error('No one should be able to reach here.')
  },
  'hello:reply': function(session, channel, msg, reply) {
    reply(null, 'Hi, how are you user ' + session.uid)
  }
}
