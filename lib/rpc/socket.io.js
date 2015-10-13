var debug = require('debug')('micromono:rpc')


module.exports = {
  client: {
    send: function(data) {
      var self = this
      this.scheduleProvider(function(provider) {
        var socket = provider.socket
        var args = data.args
        var fn

        if (typeof args[args.length - 1] === 'function') {
          fn = args.pop()
          data.cid = true
        }

        var msg = self.encodeData(data)
        fn ? socket.emit('message', msg, fn) : socket.emit('message', msg)
      })
    },

    connect: function(provider) {
      var endpoint = 'http://' + provider.address + ':' + provider.rpcPort
      var socket = require('socket.io-client')(endpoint)

      var self = this
      socket.on('disconnect', function() {
        debug('socket.io provider %s disconnected', endpoint)
        self.onProviderDisconnect(provider)
      })

      provider.socket = socket
    }
  },

  server: {

    dispatch: function(msg, socket, callback) {
      var data = this.decodeData(msg)
      var args = data.args || []
      var handler = this.getHandler(data.name)

      if (data.cid === true) {
        args.push(callback)
      }

      handler.apply(this, args)
    },

    startRPCServer: function(port) {
      var ioServer = require('socket.io')()
      ioServer.serveClient(false)
      ioServer.listen(port)

      this.announcement.rpcPort = port
      this.announcement.rpcType = 'socket.io'

      var self = this
      ioServer.on('connection', function(socket) {
        socket.on('message', function(data, callback) {
          self.dispatch(data, socket, callback)
        })
      })

      return Promise.resolve()
    }
  }


}
