/**
 * Module dependencies
 */

var discovery = require('./discovery');
var Asset = require('./asset');
var Service = require('./service');
var MicroMono = require('./micromono');


/**
 * Main module object to hold all sub-modules
 */
var micromono = function(options) {
  return new MicroMono(options);
};

/**
 * Assign submodules to the main object
 */
micromono.discovery = discovery;
micromono.Service = Service;
micromono.Asset = Asset;


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
module.exports = micromono;
