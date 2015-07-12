/**
 * Module dependencies.
 */

var zmq = require('zmq');
var util = require('util');
var assign = require('lodash.assign');
var shortid = require('shortid');
var EventEmitter = require('events').EventEmitter;


var Connector = module.exports = function Connector(options) {
  EventEmitter.call(this);
  if (options) {
    this.connect(options);
  }

  this.connections = {};
  this.webAddresses = [];
};

util.inherits(Connector, EventEmitter);

Connector.prototype = assign(Connector.prototype, {

  send: function(message) {
    this.socket.send(message);
  },

  disconnect: function(endpoint) {
    endpoint = endpoint.split(':');
    var port = endpoint[2];
    var address = endpoint[1].slice(2);
    this.webAddresses = this.webAddresses.filter(function(ep) {
      return !(ep.host === address && ep.port === port);
    });
  },

  connect: function(options) {
    var endpoint = 'tcp://' + options.address + ':' + options.port;

    if (this.connections[endpoint]) {
      return;
    }

    if (!this.socket) {
      var socket = zmq.socket('dealer');
      var self = this;
      socket.identity = shortid.generate();
      socket.monitor(100, 0);
      socket.on('disconnect', function(fd, ep) {
        console.log('provider %s disconnected', ep);
        self.disconnect(ep);
      });
      socket.on('message', function(msg) {
        self.emit('message', msg);
      });
      this.socket = socket;
    }

    this.socket.connect(endpoint);
    this.connections[endpoint] = options;

    if (options.webPort) {
      this.webAddresses.push({
        host: options.address,
        port: options.webPort
      });
    }
  },

  fetchProxyAddress: function() {
    var address = this.webAddresses.shift();
    return address;
  },

  returnProxyAddress: function(address) {
    this.webAddresses.push(address);
  }
});
