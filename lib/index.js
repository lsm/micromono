/**
 * Module dependencies
 */
var Asset = require('./web/asset')
var server = require('./server')
var assign = require('lodash.assign')
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
  assign(micromono, server)
  micromono.require = discovery.require
  micromono.register = discovery.register

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
