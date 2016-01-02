/**
 * Module dependencies
 */
var assign = require('lodash.assign')
var discovery = require('./discovery/udp')
var Asset = require('./web/asset')
var Service = require('./service')
var Server = require('./server')

/**
 * Main module object to hold all sub-modules
 */
var micromono = {}


/**
 * Assign submodules to the main object
 */
micromono.Asset = Asset
assign(micromono, Server)
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
