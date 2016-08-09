var debug = require('debug')('micromono:server:channel')
var socketmq = require('socketmq')

exports.ensureChannelGateway = function(services, set) {
  var chnGateway
  var hasServiceWithChannel = Object.keys(services).some(function(name) {
    return !!services[name].announcement.channel
  })

  if (hasServiceWithChannel) {
    debug('Create new channel gateway instance')
    chnGateway = socketmq.gateway()
    chnGateway.isUntrusted = function(stream) {
      return 'tcp' !== stream.__smq__.protocol
    }
    chnGateway.on('disconnect', function(stream) {
      if (stream.provider && stream.scheduler) {
        var provider = stream.provider
        debug('Channel provider of [%s] disconnected %s %s',
          provider.name + '@' + provider.version,
          provider.host,
          provider.id.slice(0, 8))
        stream.scheduler.remove(provider)
      }
    })
  }

  // `set` would be `setGlobal` for balancer.
  set('chnGateway', chnGateway)
  // There's a bug which `setGlobal` won't trigger the next pipe.
  // Return true to trigger next for now.
  return true
}

exports.attachChnGatewayServer = function(chnGateway, httpServer) {
  debug('Attach balancer http server to channel gateway')
  chnGateway.bind('eio://', {
    httpServer: httpServer
  })
}

exports.connectToChannel = function(channel, chnGateway, announcement, scheduler, next) {
  chnGateway.connect(channel.endpoint, function(stream) {
    debug('[%s] channel endpoint %s connected with namespaces:',
      announcement.name, channel.endpoint, channel.namespaces)
    stream.provider = announcement
    stream.scheduler = scheduler
    next && next()
  })
}

exports.channelOnNewProvider = function(chnGateway, scheduler) {
  scheduler.on('add', function(provider) {
    if (provider.channel) {
      debug('New channel provider of [%s] found %s %s',
        provider.name + '@' + provider.version,
        provider.host,
        provider.id.slice(0, 8))
      exports.connectToChannel(provider.channel, chnGateway, provider, scheduler)
    }
  })
}
