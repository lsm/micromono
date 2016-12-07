var http = require('http')


exports.prepareHealthHandler = function(healthPort, healthHandler) {
  if (!healthHandler) {
    healthHandler = function(req, res) {
      res.statusCode = 200
      res.end('ok')
    }
  }

  return {
    healthHandler: healthHandler
  }
}


exports.startHealthinessServer = function(host, healthPath, healthPort, healthHandler) {
  var server = http.createServer(function(req, res) {
    res.setHeader('Content-Type', 'text/plain')
    if (healthPath === req.url) {
      healthHandler(req, res)
    } else {
      res.statusCode = 404
      res.end('Not found')
    }
  })

  server.listen(healthPort, host)
}
