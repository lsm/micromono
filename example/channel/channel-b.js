

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
    next(null, {
      repEvents: ['hello:message', 'hello:reply'],
      subEvents: ['server:message']
    })
  },

  allow: function(session, channel, event, next) {
    next()
  },

  'hello:message': function(session, channel, msg) {
    this.pub(channel,
      'server:message',
      'message for everyone in namespace "/channel/b" channel ' + channel)
    if (!this['chn' + session.sid])
      this['chn' + session.sid] = this.service.chnBackend.channel('/channel/b', channel)

    this['chn' + session.sid].pubSid(session.sid, 'server:message',
      'This message is only for sid: ' + session.sid)
  },

  'readFile': function(session, channel, filename, reply) {
    throw new Error('No one should be able to reach here.')
  },
  'hello:reply': function(session, channel, msg, reply) {
    reply(null, 'Hi, how are you user ' + session.uid)
  }
}
