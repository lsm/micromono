/**
 * Module dependencies
 */

var async = require('async');
var spawnSync = require('child_process').spawnSync;
var Farcaster = require('./farcaster');


/**
 * Constructor for MicroMono class
 *
 * @return {MicroMono} Instance of MicroMono class
 */
var MicroMono = module.exports = function MicroMono() {
  this.services = {};
};


MicroMono.prototype = {

  require: function(package) {
    var ServiceClass;

    try {
      // @todo handle path start with './'?
      ServiceClass = require(package);
    } catch (e) {
      var probedResult = spawnSync('node', [require.resolve('./prober'), package]);
      if (probedResult.status !== 0) {
        throw new Error(probedResult.stderr.toString());
      } else {
        var serviceInfo = JSON.parse(probedResult.stdout);
        console.log('New service `%s` probed from network.', serviceInfo.name);
        console.log(serviceInfo);
        ServiceClass = Farcaster.build(serviceInfo);
      }
    }

    var serviceInstance = new ServiceClass();
    this.registerService(serviceInstance.announcement.name, serviceInstance);

    return ServiceClass;
  },

  /**
   * Boot a single locally accessable service which includes 3 components:
   *
   *   1. Service discovery server
   *   2. Http server for static asset files
   *   3. ZeroMQ RPC server
   *
   * @param  {String} packagePath Path to the package root where package.json is located
   * @return {Promise}
   */
  boot: function() {
    var services = this.services;

    return new Promise(function(resolve, reject) {
      async.map(Object.keys(services), function runService(name, callback) {
        var serviceInstance = services[name];
        serviceInstance.run()
          .then(function(socket) {
            callback(null);
          })
          .catch(callback);
      }, function bootServicesFinished(err, results) {
        err ? reject(err) : resolve();
      });
    });
  },

  registerService: function(name, serviceInstance) {
    this.services[name] = serviceInstance;
  }
};
