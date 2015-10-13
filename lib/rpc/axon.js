var axon = require('axon')
var debug = require('debug')('micromono:rpc')


module.exports = {
  client: {
    send: function(data) {
      var self = this
      this.scheduleProvider(function(provider) {
        var socket = provider.socket
        var args = data.args
        var fn

        if ('function' === typeof args[args.length - 1]) {
          fn = args.pop()
          data.cid = true
        }

        var msg = self.encodeData(data)
        socket.send(msg, fn || function() {})
      })
    },

    connect: function(provider) {
      var endpoint = 'tcp://' + provider.address + ':' + provider.rpcPort
      var socket = axon.socket('req')

      var self = this
      socket.on('disconnect', function() {
        debug('axon provider %s disconnected', endpoint)
        self.onProviderDisconnect(provider)
      })

      provider.socket = socket
    }
  },

  server: {

    dispatch: function(msg, callback) {
      var data = this.decodeData(msg)
      var args = data.args || []
      var handler = this.getHandler(data.name)

      if (data.cid === true) {
        args.push(callback)
      }

      handler.apply(this, args)
    },

    startRPCServer: function(port) {
      var self = this
      var socket = axon.socket('rep')

      this.announcement.rpcPort = port
      this.announcement.rpcType = 'axon'

      var promise = new Promise(function(resolve, reject) {
        socket.bind(port, function() {
          debug('axon socket bind on port %s', port)
          resolve()
        })

        socket.on('message', function(msg, callback) {
          self.dispatch(msg, callback)
        })
      })

      return promise
    }
  }
}
