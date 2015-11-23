/**
 * Module dependencies
 */

var discovery = require('./discovery/udp')
var Asset = require('./web/asset')
var Service = require('./service')
var MicroMonoServer = require('./server')

var instance

/**
 * Main module object to hold all sub-modules
 */
var micromono = function(options) {
  if (!instance) {
    var argv = require('./argv').parse(process.argv)
    instance = new MicroMonoServer(options, argv)
  }
  return instance
}


/**
 * Assign submodules to the main object
 */
micromono.Asset = Asset
micromono.Server = MicroMonoServer
micromono.Service = Service
micromono.discovery = discovery


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
module.exports = micromono
