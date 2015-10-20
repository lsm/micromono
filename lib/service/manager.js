var singletonify = require('./helper').singletonify

/**
 * Service manager manages services, local and/or remote.
 *
 * @param  {[type]} arguments [description]
 * @return {[type]}           [description]
 */
var ServiceManager = module.exports = function MicroMonoServiceManager() {

}


ServiceManager.prototype.register = function(ServiceClass, name) {
  var ServiceFactory = singletonify(ServiceClass)
  if (!name) {
    var serviceInstance = new ServiceFactory()
    name = serviceInstance.announcement.name
    this.instances[name] = serviceInstance
  }
  this.services[name] = ServiceFactory
  return ServiceFactory
}
