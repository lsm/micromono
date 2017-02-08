/**
 * Module dependencies
 */
var ip = require('ip')
var entry = require('./entry')
var config = require('./config')
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
  micromono.register = discovery.register.bind(micromono)
  micromono.Service = service.Service
  micromono.createService = service.createService

  // Expose constructor
  micromono.Micromono = Micromono

  // Apply default configurations
  micromono.defaultConfig()

  if (micromono.get('MICROMONO_DISCOVERY_AGENT')) {
    // Running in discovery agent mode. No service or server will be started.
    // It's also not possible to require services.
    micromono.startService = function() {}
    micromono.startBalancer = function() {}
    micromono.require = function() {}
    // Run prober
    require('./discovery/prober')
    // Ignore uncaught exception for this case.
    process.removeAllListeners('uncaughtException')
    process.on('uncaughtException', function(err) {
      console.error('\n\tCaught "uncaughtException" in agent mode. The error might be okay to be ignored:\n\t', err, '\n');
    })
  } else {
    micromono.startService = entry.startService.bind(null, micromono)
    micromono.startBalancer = entry.startBalancer.bind(null, micromono)
    micromono.require = discovery.require.bind(micromono)
    micromono.set('require', micromono.require)
  }

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

  // Load configurations from command line and env.
  var options = config(['default', 'discovery', 'health', 'service', 'server'])
  this.serviceDir = options.serviceDir
  this.config(options)
}

/**
 * Exports the main MicroMono instance object.
 *
 * @type {Object}
 */
module.exports = new Micromono()

process.on('SIGINT', function() {
  console.log('\n\tShutting down micromono...\n')
  process.exit(0)
})
