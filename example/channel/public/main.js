var socketmq = require('socketmq')
var smq = socketmq()

smq.on('message', function(msg) {
  console.log('onmessage', msg.toString())
})

var firstChannel = smq.channel('/channel/a', 'room x')

firstChannel.sub('server:message', function(msg) {
  msg = '<b>/channel/a: </b>' + new Date() + ' message from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br /><br />'
})

firstChannel.on('join', function() {
  console.log('"/channel/a" "room x" Joined')
})

firstChannel.req('hello:reply', 'Hi server', function(err, msg) {
  msg = '<b>/channel/a: </b>' + new Date() + ' reply from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br /><br />'
})

setTimeout(function() {
  firstChannel.req('hello:message', 'message from client')
}, 2000)


var secondChannel = smq.channel('/channel/b', 'room y')

secondChannel.sub('server:message', function(msg) {
  msg = '<b>/channel/b: </b>' + new Date() + ' message from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br /><br />'
})

secondChannel.on('join', function() {
  console.log('"/channel/b" "room y" Joined')
})


secondChannel.req('hello:reply', 'Hi server', function(err, msg) {
  msg = '<b>/channel/b: </b>' + new Date() + ' reply from server: <br />' + msg
  var el = document.getElementById('message')
  el.innerHTML += msg + '<br /><br />'
})


setTimeout(function() {
  secondChannel.req('hello:message', 'message from client')
}, 1000)


smq.connect('eio://', function(stream) {
  console.log(stream);
})
