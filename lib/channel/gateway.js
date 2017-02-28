var logger = require('../logger')('micromono:channel:gateway')
var socketmq = require('socketmq')

exports.ensureChannelGateway = function(services, set) {
  logger.debug('ensureChannelGateway')

  var chnGateway
  var hasServiceWithChannel = Object.keys(services).some(function(name) {
    return !!services[name].announcement.channel
  })

  if (hasServiceWithChannel) {
    logger.info('Create new Channel gateway instance')

    chnGateway = socketmq.gateway()
    chnGateway.isUntrusted = function(stream) {
      return 'tcp' !== stream.__smq__.protocol
    }
    chnGateway.on('disconnect', function(stream) {
      if (stream.provider && stream.scheduler) {
        var provider = stream.provider

        logger.info('Channel provider disconnected', {
          service: provider.name + '@' + provider.version,
          host: provider.host
        }).trace(provider)

        stream.scheduler.remove(provider)
      }
    })
    chnGateway.on('error', function(err) {
      var provider = err.stream && err.stream.provider
      var name
      var host
      if (provider) {
        name = provider.name
        host = provider.host
      }
      logger.error('Channel provider error', {
        service: name,
        host: host
      })
    })
  }

  // `set` would be `setGlobal` for balancer.
  set('chnGateway', chnGateway)
  // There's a bug which `setGlobal` won't trigger the next pipe.
  // Return true to trigger next for now.
  return true
}

exports.attachChnGatewayServer = function(chnGateway, httpServer) {
  logger.debug('attachChnGatewayServer')
  chnGateway.bind('eio://', {
    httpServer: httpServer
  })
}

exports.connectToChannel = function(channel, chnGateway, announcement, scheduler, next) {
  logger.debug('connectToChannel')
  chnGateway.connect(channel.endpoint, function(stream) {
    logger.info('New channel provider connected', {
      service: announcement.name + '@' + announcement.version,
      endpoint: channel.endpoint,
      namespaces: channel.namespaces
    }).trace(announcement)

    stream.provider = announcement
    stream.scheduler = scheduler
    next && next()
  })
}

exports.channelOnNewProvider = function(chnGateway, scheduler) {
  logger.debug('channelOnNewProvider')
  scheduler.on('add', function(provider) {
    if (provider.channel) {
      logger.info('Found new channel provider', {
        service: provider.name + '@' + provider.version,
        host: provider.host
      }).trace(provider)

      exports.connectToChannel(provider.channel, chnGateway, provider, scheduler)
    }
  })
}
