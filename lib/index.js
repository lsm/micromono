/**
 * Module dependencies
 */
var assign = require('lodash.assign');
var discovery = require('./discovery');
var Service = require('./service');
var MicroMono = require('./micromono');


/**
 * Main module object to hold all sub-modules
 */
var micromono = function() {
  return new MicroMono();
};

/**
 * Assign submodules to the main object
 */
assign(micromono, discovery);
micromono.Service = Service;
micromono.boot = require('./boot');
micromono.Asset = require('./asset');


/**
 * Exports the main MicroMono library. It contains the following members:
 *
 * {
 *  annouce: "udp multicast information in local network",
 *  listen: "listen to local network multicast",
 *  Service: "Constructor for defining a micromono service"
 *
 * }
 *
 * @type {Object}
 */
module.exports = micromono;
