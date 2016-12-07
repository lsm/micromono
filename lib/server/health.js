var http = require('http')


exports.prepareHealthAliveHandler = function(healthAliveHandler) {
  if (!healthAliveHandler) {
    healthAliveHandler = function(req, res) {
      res.statusCode = 200
      res.end('ok')
    }
  }

  return {
    healthAliveHandler: healthAliveHandler
  }
}

exports.prepareHealthFunctionalHandler = function(services, healthFunctionalHandler) {
  if (!healthFunctionalHandler) {
    healthFunctionalHandler = function(req, res) {
      var allDependenciesAvailable = true

      if (services) {
        allDependenciesAvailable = Object.keys(services)
          .filter(function(serviceName) {
            return true === services[serviceName].isRemote
          })
          .every(function(serviceName) {
            return services[serviceName].scheduler.len() > 0
          })
      }

      if (allDependenciesAvailable) {
        res.statusCode = 200
        res.end('ok')
      } else {
        res.statusCode = 503
        res.end('Service error')
      }
    }
  }

  return {
    healthFunctionalHandler: healthFunctionalHandler
  }
}


exports.startHealthinessServer = function(host, healthPort, healthinessHandlers) {
  var alivePath = healthinessHandlers.alivePath
  var aliveHandler = healthinessHandlers.aliveHandler
  var functionalPath = healthinessHandlers.functionalPath
  var functionalHandler = healthinessHandlers.functionalHandler

  var server = http.createServer(function(req, res) {
    res.setHeader('Content-Type', 'text/plain')
    switch (req.url) {
      case alivePath:
        aliveHandler(req, res)
        break
      case functionalPath:
        functionalHandler(req, res)
        break
      default:
        res.statusCode = 404
        res.end('Not found')
    }
  })

  server.listen(healthPort, host)
}
