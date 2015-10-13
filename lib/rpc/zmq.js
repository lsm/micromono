var zmq = require('zmq')
var debug = require('debug')('micromono:rpc')
var shortid = require('shortid')
var toArray = require('lodash.toarray')


module.exports = {

  client: {

    send: function(data) {
      var args = data.args

      if (typeof args[args.length - 1] === 'function') {
        // last argument is a callback function, add callback identity to data
        var cid = this.generateID()
        data.cid = cid
        this.callbacks[cid] = args.pop()
      }

      var msg = this.encodeData(data)
      this.socket.send(msg)
    },

    dispatch: function(msg) {
      var data = this.decodeData(msg)

      if (data.cid) {
        var args = data.args
        var callback = this.callbacks[data.cid]
        if (typeof callback === 'function') {
          callback.apply(this, args)
        }
      }
    },

    connect: function(provider) {
      var endpoint = 'tcp://' + provider.address + ':' + provider.rpcPort

      if (!this.socket) {
        var socket = zmq.socket('dealer')
        var self = this
        socket.identity = shortid.generate()
        socket.monitor(100, 0)
        socket.on('disconnect', function(fd, ep) {
          debug('zmq provider %s disconnected', ep)
          self.onProviderDisconnect(provider)
        })
        socket.on('data', function(msg) {
          self.dispatch(msg)
        })
        this.socket = socket
      }

      this.socket.connect(endpoint)
    }
  },

  server: {

    /**
     * Dispatch message to local route/api handler
     *
     * @param  {String} msg      A JSON string with following properties:
     *                           {
     *                             // when there's callback in the function signature
     *                             cid: 'Vk7HgAGv',
     *                             // name of the RPC api
     *                             name: 'createPost'
     *                             // input arguments for the api
     *                             // A callback will be generated and
     *                             // pushed to the end of `args` if `cid` exists
     *                             args: ['this', 'is', 'data'],
     *
     *                           }
     * @param  {String} envelope String identity of the sending client
     */
    dispatch: function(msg, envelope) {
      var data = this.decodeData(msg)
      var args = data.args || []
      var handler = this.getHandler(data.name)
      var self = this

      if (data.cid) {
        var callback = function() {
          var _args = toArray(arguments)
          var _data = {
            cid: data.cid,
            args: _args
          }
          self.socket.send([envelope, self.encodeData(_data)])
        }
        args.push(callback)
      }

      handler.apply(this, args)
    },

    startRPCServer: function(port) {
      var self = this

      var _port = 'tcp://0.0.0.0:' + port
      var socket = zmq.socket('router')
      var ann = this.announcement
      ann.rpcPort = port
      ann.rpcType = 'zmq'
      socket.identity = ann.name + '::' + _port
      self.socket = socket

      return new Promise(function(resolve, reject) {
        socket.bind(_port, function(err) {
          if (err) {
            return reject(err)
          }

          socket.on('message', function(envelope, msg) {
            self.dispatch(msg, envelope)
          })

          resolve()
        })
      })
    }
  }

}
