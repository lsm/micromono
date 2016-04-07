var socketmq = require('socketmq')

var smq = socketmq.connect('eio://', {
  path: '/channel/socket'
})

setInterval(function() {
  smq.pub('hello channel', 'message from client')
}, 1000)

smq.sub('from server', function(msg) {
  console.log('msg from server 1', msg);
})
