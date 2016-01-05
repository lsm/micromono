var path = require('path')
var debug = require('debug')('micromono:server')
var callsite = require('callsite')
var SuperPipe = require('superpipe')
var argsNames = require('js-args-names')
var ServicePipe = require('./service/pipe')
var ServicePipeline = require('./service/pipeline')


/**
 * Start a service with standalone internal web/rpc server.
 *
 * @param  {Service} ServiceClass Service class.
 */
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
    packagePath = getCallerPath()
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
    debug('`startService` pipeline error', err && err.stack || err)
    process.exit(-1)
  })

  // Execute the pipeline
  pipeline.toPipe()()
}
function getCallerPath() {
  var stack = callsite()
  var callerFilename = stack[2].getFileName()
  return path.dirname(callerFilename)
}
