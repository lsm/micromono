var socketmq = require('socketmq')

var smq = socketmq.channel('/channel/a', 'my room')
smq.connect('eio://', function(stream) {
  console.log(stream);
})

smq.sub('server:message', function(msg) {
  msg = '<b>/channel/a: </b>' + new Date() + ' message from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br /><br />'
})

smq.on('join', function() {
  console.log('Joined')
})

smq.req('hello:reply', 'Hi server', function(err, msg) {
  msg = '<b>/channel/a: </b>' + new Date() + ' reply from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br /><br />'
})

setInterval(function() {
  smq.req('hello:message', 'message from client')
}, 2500)


var secondSmq = socketmq.channel('/channel/b', 'someone\'s room')
secondSmq.connect('eio://', function(stream) {
  console.log(stream);
})

secondSmq.sub('server:message', function(msg) {
  msg = '<b>/channel/b: </b>' + new Date() + ' message from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br /><br />'
})

secondSmq.on('join', function() {
  console.log('Joined')
})

secondSmq.req('hello:reply', 'Hi server', function(err, msg) {
  msg = '<b>/channel/b: </b>' + new Date() + ' reply from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br /><br />'
})

setInterval(function() {
  secondSmq.req('hello:message', 'message from client')
}, 2500)
