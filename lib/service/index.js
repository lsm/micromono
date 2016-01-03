/**
 * Module dependencies.
 */
var assign = require('lodash.assign')
var extend = require('ampersand-class-extend')
var EventEmitter = require('eventemitter3')


/**
 * MicroMono Service class constructor.
 */
var Service = module.exports = function MicroMonoService() {}


// Provide the ability to extend the Service class.
Service.extend = extend

// Service is an event emitter
assign(Service.prototype, EventEmitter.prototype)
