var debug = require('debug')('micromono:server:channel')
var socketmq = require('socketmq')

exports.ensureChannelGateway = function(services, set) {
  var chnGateway
  var hasServiceWithChannel = Object.keys(services).some(function(name) {
    return !!services[name].announcement.channel
  })

  if (hasServiceWithChannel) {
    debug('Create new Channel gateway instance')
    chnGateway = socketmq.gateway()
    chnGateway.isUntrusted = function(stream) {
      return 'tcp' !== stream.__smq__.protocol
    }
    chnGateway.on('disconnect', function(stream) {
      if (stream.provider && stream.scheduler) {
        var provider = stream.provider
        debug('Service [%s] Channel provider "%s" disconnected',
          provider.name + '@' + provider.version,
          provider.host)
        stream.scheduler.remove(provider)
      }
    })
    chnGateway.on('error', function(err) {
      var provider = err.stream && err.stream.provider
      var name, host
      if (provider) {
        name = provider.name
        host = provider.host
      }
      debug('ERROR: service [%s] Channel provider "%s"', name, host)
    })
  }

  // `set` would be `setGlobal` for balancer.
  set('chnGateway', chnGateway)
  // There's a bug which `setGlobal` won't trigger the next pipe.
  // Return true to trigger next for now.
  return true
}

exports.attachChnGatewayServer = function(chnGateway, httpServer) {
  debug('Attach balancer http server to Channel gateway')
  chnGateway.bind('eio://', {
    httpServer: httpServer
  })
}

exports.connectToChannel = function(channel, chnGateway, announcement, scheduler, next) {
  chnGateway.connect(channel.endpoint, function(stream) {
    debug('Service [%s] Channel endpoint "%s" connected with namespaces:',
      announcement.name, channel.endpoint, channel.namespaces)
    stream.provider = announcement
    stream.scheduler = scheduler
    next && next()
  })
}

exports.channelOnNewProvider = function(chnGateway, scheduler) {
  scheduler.on('add', function(provider) {
    if (provider.channel) {
      debug('Service [%s] new Channel provider found at "%s"',
        provider.name + '@' + provider.version,
        provider.host)
      exports.connectToChannel(provider.channel, chnGateway, provider, scheduler)
    }
  })
}
