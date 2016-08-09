var Superpipe = require('superpipe')

exports.setupChannel = Superpipe.pipeline()
  .pipe('normalizeChannels?', 'channel', 'channels')
  .pipe('checkChannelPropertyName?', ['channels', 'service'])
  .pipe('createChannelAdapters?',
    ['channels', 'service'],
    ['chnBackend', 'chnAdapters'])
  .pipe('setupChannels?',
    ['channels', 'chnAdapters', 'initChannel', 'service', 'next'])

exports.initChannel = Superpipe.pipeline()
  .pipe('setDefaultChannelHandlers?', 'channel')
  .pipe('bindChannelMethods?', ['channel', 'chnAdapter', 'service'])
  .pipe('buildJoinHook?', 'channel', 'chnJoinHook')
  .pipe('buildAllowHook?', 'channel', 'chnAllowHook')
  .pipe('attachAllowHook?', ['chnAdapter', 'channel', 'chnJoinHook', 'chnAllowHook'])
  .pipe('attachEventHandlers?', ['chnAdapter', 'channel'], 'chnRepEvents')
