/**
 * Module dependencies
 */
var server = require('./server')
var service = require('./service')
var discovery = require('./discovery')
var Superpipe = require('superpipe')


/**
 * Micromono constructor
 */
var Micromono = function() {
  var micromono = this

  // Store instances of services
  micromono.services = {}
  // Make instance of superpipe
  var superpipe = new Superpipe()
  micromono.superpipe = superpipe.autoBind(true)
  // Add configurable api using superpipe
  micromono.set = superpipe.setDep.bind(superpipe)
  micromono.get = superpipe.getDep.bind(superpipe)
  // Assign submodules to the main object
  micromono.startService = service.startService.bind(micromono)
  micromono.startBalancer = server.startBalancer.bind(micromono)
  micromono.require = discovery.require.bind(micromono)
  micromono.register = discovery.register.bind(micromono)
  micromono.Service = service.Service
  micromono.createService = service.createService

  // Expose constructor
  micromono.Micromono = Micromono

  // Apply default configurations
  this.defaultConfig()

  return micromono
}

Micromono.prototype.defaultConfig = function() {
  // Bundle asset for dev?
  if ('development' === process.env.NODE_ENV
    && undefined === this.get('bundle dev'))
    this.set('bundle dev', true)

  this.set('services', this.services)
}

/**
 * Exports the main MicroMono instance object.
 *
 * @type {Object}
 */
module.exports = new Micromono()
