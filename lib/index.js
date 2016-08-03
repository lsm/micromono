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
  micromono.superpipe = Superpipe()
  micromono.superpipe.autoBind(true)
  // Assign submodules to the main object
  micromono.startService = service.startService.bind(null, micromono)
  micromono.startBalancer = server.startBalancer.bind(micromono)
  micromono.require = discovery.require.bind(micromono)
  micromono.register = discovery.register.bind(micromono)
  micromono.Service = service.Service
  micromono.createService = service.createService

  // Expose constructor
  micromono.Micromono = Micromono

  // Apply default configurations
  micromono.defaultConfig()

  return micromono
}

// Add configurable api using superpipe
Micromono.prototype.set = function(name, deps, props) {
  this.superpipe.set(name, deps, props)
  return this
}

Micromono.prototype.get = function(name) {
  return this.superpipe.get(name)
}

Micromono.prototype.defaultConfig = function() {
  // Bundle asset for dev?
  if ('development' === process.env.NODE_ENV
    && undefined === this.get('bundle dev'))
    this.set('bundle dev', true)

  this.set('services', this.services)

  process.on('SIGINT', function() {
    console.log('\nShutting down micromono...')
    process.exit(0)
  })
}

/**
 * Exports the main MicroMono instance object.
 *
 * @type {Object}
 */
module.exports = new Micromono()
