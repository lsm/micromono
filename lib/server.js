var path = require('path')
var debug = require('debug')('micromono:server')
var callsite = require('callsite')
var SuperPipe = require('superpipe')
var argsNames = require('js-args-names')
var ServicePipe = require('./service/pipe')
var ServicePipeline = require('./service/pipeline')


exports.startService = function(Service) {
  var service
  if ('function' === typeof Service) {
    service = new Service()
  } else {
    service = Service
  }

  var superpipe = new SuperPipe()
  superpipe
    .autoBind(true)
    .setDep(ServicePipe, '*^')
    .setDep('service', service)

  var packagePath = service.packagePath
  if (!packagePath) {
    // Guess package path based on the caller of this function
    var stack = callsite()
    var callerFilename = stack[1].getFileName()
    packagePath = path.dirname(callerFilename)
  }

  debug('packagePath %s', packagePath)

  superpipe.setDep('packagePath', packagePath)

  // Clone the pipeline and connect to local superpipe instance
  var pipeline = ServicePipeline.initLocalService.slice().connect(superpipe)

  if (service.init) {
    var initArgs = argsNames(service.init)
    // Add service.init to pipeline
    pipeline.pipe(service.init, initArgs)
  }

  pipeline.error(function(err) {
    debug('`startService` pipeline error', err)
    process.exit(-1)
  })

  // Execute the pipeline
  pipeline.toPipe()()
}
