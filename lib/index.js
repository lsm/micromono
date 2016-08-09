/**
 * Module dependencies
 */
var ip = require('ip')
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

Micromono.prototype.config = function(options) {
  var micromono = this
  Object.keys(options).forEach(function(key) {
    if (/^MICROMONO_/.test(key))
      micromono.set(key, options[key])
  })
  return this
}

Micromono.prototype.defaultConfig = function() {
  // Bundle asset for dev?
  if ('development' === process.env.NODE_ENV
    && undefined === this.get('MICROMONO_BUNDLE_DEV'))
    this.set('MICROMONO_BUNDLE_DEV', true)

  this.set('services', this.services)
  // Default configurations
  var host = process.env.HOST || ip.address() || '0.0.0.0'
  this.set({
    MICROMONO_PORT: process.env.PORT || 0,
    MICROMONO_HOST: host,
    MICROMONO_RPC_PORT: 0,
    MICROMONO_RPC_HOST: host,
    MICROMONO_CHN_ENDPOINT: 'tcp://' + host
  })
}

/**
 * Exports the main MicroMono instance object.
 *
 * @type {Object}
 */
module.exports = new Micromono()

process.on('SIGINT', function() {
  console.log('\nShutting down micromono...')
  process.exit(0)
})
