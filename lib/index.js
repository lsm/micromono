/**
 * Module dependencies
 */

var discovery = require('./discovery/udp')
var Asset = require('./web/asset')
var Service = require('./service')
var MicroMono = require('./micromono')

var instance

/**
 * Main module object to hold all sub-modules
 */
var micromono = function(options) {
  if (!instance) {
    instance = new MicroMono(options)
  }
  return instance
}

/**
 * Assign submodules to the main object
 */
micromono.discovery = discovery
micromono.Service = Service
micromono.Asset = Asset


/**
 * Exports the main MicroMono library. It contains the following members:
 *
 * {
 *  annouce: "udp multicast information in local network",
 *  listen: "listen to local network multicast",
 *  Service: "Constructor for defining a micromono service"
 * }
 *
 * @type {Object}
 */
module.exports = micromono
