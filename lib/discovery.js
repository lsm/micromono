var dgram = require('dgram');

var MULTICAST_ADDRESS = '224.0.0.116';
var UDP_PORT = 11628;

exports.announce = function(data, interval) {
  interval = interval || 250;

  var socket = dgram.createSocket('udp4');
  var buf = JSON.stringify(data);

  var send = function() {
    socket.send(buf, 0, Buffer.byteLength(buf), UDP_PORT, MULTICAST_ADDRESS);
  };

  send();

  setInterval(send, interval);
};

exports.listen = function(callback) {
  var socket = dgram.createSocket('udp4');

  socket.bind(UDP_PORT, function() {
    socket.addMembership(MULTICAST_ADDRESS);
  });

  socket.on('error', function(err) {
    if (err) {
      if (err.errno === 'EADDRINUSE') {
        console.warn('UDP port in use, please make sure you don\'t have other instances of micromono running as consumer with the same network settings.');
      }
    }
    callback(err);
  });

  socket.on('message', function(data, rinfo) {
    data = JSON.parse(data);
    data.address = rinfo.address;
    callback(null, data, rinfo);
  });
};
