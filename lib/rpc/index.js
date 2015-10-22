var util = require('util')
var debug = require('debug')('micromono:rpc')
var toArray = require('lodash.toarray')
var getFnArgs = require('../helper').getFnArgs

/**
 * The RPC class for managing different transport adapters.
 *
 * @param  {Object} options Options for RPC with following format:
 *
 * ```javascript
 * {
 *   api: {
 *     fn: function(){}
 *   }, // an object contains handler functions
 *   type: 'axon', // type of adapter or adapter it self
 *   context: obj, // the `this` for handler functions
 *   isRemote: true, // whether this is client side or server side
 *   scheduler: obj, // the scheduler for distributing requests, client side only
 * }
 * ```
 *
 * @return {RPC}         Instance of RPC.
 */
var RPC = module.exports = function MicroMonoRPC(options) {
  var rpcAdapter

  // figure out adapter
  if ('string' === typeof options.type) {
    this.type = options.type
    rpcAdapter = require('./' + this.type)
  } else if ('object' === typeof options.type) {
    rpcAdapter = options.type
    this.type = rpcAdapter.type
  } else {
    throw new Error('options.type should be either type of adapter or the adapter itself, got ' + typeof options.type)
  }

  // internal object holds all the api handlers
  this._handlers = {}

  // add client or server features
  if (options.isRemote) {
    this.send = rpcAdapter.send
    this.connect = rpcAdapter.connect
    this.scheduler = options.scheduler
    if (options.api) {
      Object.keys(options.api).forEach(this.addRemoteAPI.bind(this))
    }
  } else {
    this.startServer = rpcAdapter.startServer
    if (options.api) {
      var api = options.api
      var self = this
      Object.keys(api).forEach(function(apiName) {
        var handler = api[apiName]
        self.addAPI(apiName, handler, options.context)
      })
    }
  }
}

/**
 * Handler for disconnect event of provider
 *
 * @param  {Object} provider The provider has been disconnected
 */
RPC.prototype.onProviderDisconnect = function(provider) {
  debug('provider disconnected', util.inspect(provider, {
    colors: true,
    depth: 4
  }))
  this.scheduler.remove(provider)
}

/**
 * Add an API handler.
 *
 * @param {String} name       Name of the api.
 * @param {Function} handler  Handler of the api.
 * @param {Object} [context]  Optional context for the handler.
 */
RPC.prototype.addAPI = function(name, handler, context) {
  if ('function' === typeof handler) {
    debug('add api "%s"', name)

    var args = getFnArgs(handler)

    if (context) {
      handler = handler.bind(context)
    }

    this._handlers[name] = {
      name: name,
      args: args,
      handler: handler
    }
  }
}

/**
 * Generate a remote api handler based on name.
 *
 * @param {String} name Name of the remote api.
 */
RPC.prototype.addRemoteAPI = function(name) {
  debug('generate local interface of remote api "%s"', name)
  var self = this

  this._handlers[name] = function() {
    var args = toArray(arguments)
    var data = {
      name: name,
      args: args
    }
    self.send(data)
  }
}

/**
 * Get an api handler by name.
 *
 * @param {String} name       Name of the api.
 * @param {Function} The handler function.
 */
RPC.prototype.getHandler = function(name) {
  return this._handlers[name]
}

/**
 * Get all api handlers.
 *
 * @param {Object} The api handlers object.
 */
RPC.prototype.getAPIs = function() {
  return this._handlers
}

/**
 * Dispatch message received to corresponding api handler.
 *
 * @param  {String|Buffer}   msg      The message data.
 * @param  {Function} reply A callback function for replying the result to client.
 */
RPC.prototype.dispatch = function(msg, reply) {
  var data = this.deserialize(msg)
  var handler = this.getHandler(data.name)

  if (handler) {
    var args = data.args || []
    if (true === data.cid) {
      args.push(reply)
    }

    handler.apply(null, args)
  }
}

/**
 * Serialize data.
 *
 * @param  {Any}    data Data to serialize.
 * @return {String}      Serialized data.
 */
RPC.prototype.serialize = function(data) {
  return JSON.stringify(data)
}

/**
 * Deserialize message to data.
 *
 * @param  {String} msg Message data to deserialize.
 * @return {Any}        Deserialized data.
 */
RPC.prototype.deserialize = function(msg) {
  return JSON.parse(msg)
}
