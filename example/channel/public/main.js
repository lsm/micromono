var socketmq = require('socketmq')

var smq = socketmq.channel('/example/channel', 'my room')
smq.connect('eio://dev.instbrew.com:3000', function(stream) {
  console.log(stream);
})

smq.sub('server:message', function(msg) {
  msg = new Date() + ' message from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br />'
})

smq.on('join', function() {
  console.log('Joined')
})

smq.req('hello:reply', 'Hi server', function(err, msg) {
  msg = new Date() + ' reply from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br />'
})

setInterval(function() {
  smq.req('hello:message', 'message from client')
}, 2000)
