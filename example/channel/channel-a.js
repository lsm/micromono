

module.exports = {
  namespace: '/channel/a',
  auth: function(meta, next) {
    // console.log('auth', meta)
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
    console.log('join a', session, channel)
    next(null, {
      repEvents: ['hello:message', 'hello:reply'],
      subEvents: ['server:message']
    })
  },

  allow: function(session, channel, event, next) {
    // console.log('allow', session, channel, event)
    next()
  },

  'hello:message': function(session, channel, msg) {
    console.log('/channel/a hello:message', session, channel, msg)
    this.pub('/channel/a', channel, 'server:message', 'message for everyone in /channel/a ' + channel)

    this.chnBackend
      .channel('/channel/a', channel)
      .pubSid(session.sid, 'server:message',
        'This message is only for sid: ' + session.sid + ' /channel/a ' + channel)
  },

  'readFile': function(session, channel, filename, reply) {
    throw new Error('No one should be able to reach here.')
  },
  'hello:reply': function(session, channel, msg, reply) {
    // console.log('hello:reply', session, channel, msg);
    reply(null, 'Hi, how are you user ' + session.uid)
  }
}
