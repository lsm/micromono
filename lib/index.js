/**
 * Module dependencies
 */
var Asset = require('./web/asset')
var server = require('./server')
var service = require('./service')
var discovery = require('./discovery')


/**
 * Micromono constructor
 */
var Micromono = function() {
  var micromono = {}

  // Store instances of services
  micromono.services = {}
  // Assign submodules to the main object
  micromono.Asset = Asset
  micromono.startService = server.startService.bind(micromono)
  micromono.startBalancer = server.startBalancer.bind(micromono)
  micromono.require = discovery.require.bind(micromono)
  micromono.register = discovery.register.bind(micromono)
  micromono.Service = service.Service
  micromono.createService = service.createService

  // Expose constructor
  micromono.Micromono = Micromono

  return micromono
}

/**
 * Exports the main MicroMono library. It contains the following members:
 *
 * {
 *  Asset: "Class for managing static assets",
 *  Server: "Class for running balancer and services",
 *  Service: "Constructor for defining a micromono service",
 *  discovery: "Submodule for service discovery"
 * }
 *
 * @type {Object}
 */
module.exports = Micromono()
