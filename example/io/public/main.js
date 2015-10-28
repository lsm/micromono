var socket = require('socket.io-client')({path: '/io/example-socket'});
socket.emit('message', 'first message');

setInterval(function() {
  socket.emit('message', 'hello');
}, 2000);

socket.on('message', function(msg) {
  msg = new Date() + '<br />' + 'message from server: ' + msg;
  var el = document.getElementById('message');
  el.innerHTML += msg + '<br />';
});

socket.on('connect', function() {
  console.log('client connected');
});