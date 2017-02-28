var logger = require('../logger')('micromono:rpc')
var toArray = require('lodash.toarray')


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
 *   isRemote: true, // whether this is client side or server side
 *   scheduler: obj, // the scheduler for distributing requests, client side only
 * }
 * ```
 *
 * @return {RPC}         Instance of RPC.
 */
var RPC = module.exports = function MicromonoRPC(options) {
  logger.info('Initialize MicromonoRPC', {
    type: options.type,
    isRemote: options.isRemote
  }).trace(options)

  var rpcAdapter

  // figure out adapter
  if ('string' === typeof options.type) {
    this.type = options.type
    rpcAdapter = require('./' + this.type)
  } else if ('object' === typeof options.type) {
    rpcAdapter = options.type
    this.type = rpcAdapter.type
  }

  if ('function' === typeof rpcAdapter) {
    rpcAdapter = new rpcAdapter()
    // Keep a reference of the adpater so if adpater support multiple connections
    // it can refer to itself handle that internally.
    this.adapter = rpcAdapter
  }

  if ('object' !== typeof rpcAdapter)
    throw new Error('options.type should be either type of adapter or the adapter itself, got ' + typeof options.type)

  // internal object holds all the api handlers
  this._handlers = {}

  // Override serializer if found in adapter.
  if (rpcAdapter.serialize)
    this.serialize = rpcAdapter.serialize

  if (rpcAdapter.deserialize)
    this.deserialize = rpcAdapter.deserialize

  // add client or server features
  if (options.isRemote)
    this.prepareClient(rpcAdapter, options)
  else
    this.prepareServer(rpcAdapter, options)
}

RPC.prototype.prepareClient = function(rpcAdapter, options) {
  logger.debug('Prepare RPC client', {
    type: options.type,
    service: options.ann.name + '@' + options.ann.version
  }).trace(options)

  var self = this
  this.ann = options.ann
  this.send = rpcAdapter.send
  this.connect = rpcAdapter.connect
  this.scheduler = options.scheduler
  this.scheduler.on('add', function(provider) {
    logger.info('Found new RPC provider', {
      host: provider.host,
      service: provider.name + '@' + provider.version
    }).trace(provider)
    self.connect(provider)
  })

  if (options.api)
    Object.keys(options.api).forEach(this.addRemoteAPI.bind(this))
}

RPC.prototype.prepareServer = function(rpcAdapter, options) {
  logger.debug('Prepare RPC server', {
    type: options.type
  }).trace(options)

  this.startServer = rpcAdapter.startServer
  if (options.api) {
    var api = options.api
    var self = this
    Object.keys(api).forEach(function(apiName) {
      var handler = api[apiName]
      // Add local api handler
      self.addAPI(apiName, handler)
    })
  }
}

/**
 * Handler for disconnect event of provider
 *
 * @param  {Object} provider The annoucement data of disconnected provider.
 */
RPC.prototype.onProviderDisconnect = function(provider) {
  logger.info('RPC provider disconnected', {
    id: provider.id.slice(0, 8),
    host: provider.host,
    service: provider.name + '@' + provider.version
  }).trace(provider)

  this.scheduler.remove(provider)
}

/**
 * Add an API handler.
 *
 * @param {String} name       Name of the api.
 * @param {Function} handler  Handler of the api.
 */
RPC.prototype.addAPI = function(name, handler) {
  if ('function' === typeof handler) {
    logger.debug('Add server api', {
      name: name,
      args: handler.args
    })

    this._handlers[name] = {
      name: name,
      args: handler.args,
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
  logger.debug('Generate local interface of remote api', {
    name: name,
    service: this.ann.name + '@' + this.ann.version
  })

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
  var handler = this._handlers[name]
  if (handler && handler.handler)
    handler = handler.handler

  return handler
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
    if (true === data.cid)
      args.push(reply)

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
