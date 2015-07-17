/**
 * Module dependencies
 */

var path = require('path');
var async = require('async');
var Asset = require('./asset');
var partialRender = require('./render');
var discovery = require('./discovery');
var Farcaster = require('./farcaster');
var spawnSync = require('child_process').spawnSync;


/**
 * Parse commmand line arguments
 */
var argv = require('minimist')(process.argv);
var SERVICE_DIR = argv['service-dir'];


/**
 * Constructor for MicroMono class
 *
 * @return {MicroMono} Instance of MicroMono class
 */
var MicroMono = module.exports = function MicroMono(options) {
  this.options = this.getDefaultOptions(options);
  this.services = {};
};

/**
 * MicroMono public API.
 *
 * @type {Object}
 */
MicroMono.prototype = {

  getDefaultOptions: function(options) {
    options = options || {};

    if (!options.packagePath) {
      var parentFile = module.parent.parent.filename;
      options.packagePath = path.dirname(parentFile);
    }

    return options;
  },

  getPackageInfo: function(packagePath) {
    this.asset = new Asset(packagePath);

    try {
      this.asset.parseJSPM();
    } catch (e) {}
  },

  require: function(package) {
    var ServiceClass;

    try {
      // @todo handle path start with './'?
      if (SERVICE_DIR) {
        package = path.resolve(SERVICE_DIR, package);
      }
      ServiceClass = require(package);
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') {
        // throw error if we found the module which contains error.
        throw e;
      }
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

    var serviceInstance;
    // Singleton service factory
    var ServiceFactory = ServiceClass.extend({
      constructor: function() {
        if (!serviceInstance) {
          serviceInstance = new ServiceClass();
        }
        return serviceInstance;
      }
    });

    this.registerService(package, ServiceFactory);

    return ServiceFactory;
  },

  /**
   * @param  {Function} [app] Instance of express application
   * @return {Promise}
   */
  boot: function(app) {
    var self = this;
    var services = this.services;
    this.getPackageInfo(this.options.packagePath);

    if (app && app.get('views')) {
      app.use(partialRender(app));
    }

    var promise = self.asset.configJSPM()
      .then(function() {
        return new Promise(function(resolve, reject) {
          async.each(Object.keys(services), function runService(name, callback) {
            var serviceInstance = services[name];
            if (typeof serviceInstance === 'function') {
              serviceInstance = new serviceInstance();
              self.registerService(name, serviceInstance);
            }
            self.asset.mergeJSPMDeps(serviceInstance.announcement.client);
            serviceInstance.run(app).then(callback).catch(callback);
          }, function bootServicesFinished(err) {
            err ? reject(err) : resolve();
          });
        });
      });

    if (app) {
      // assume we are in the consumer mode
      promise = promise.then(function() {
        discovery.listen(function(err, data, rinfo) {
          if (err) {
            if (err.errno === 'EADDRINUSE') {
              console.warn('UDP port in use, please make sure you don\'t have other instances of micromono running as consumer.');
            }
            return;
          }
          var serviceName = data.name;
          var serviceInstance = services[serviceName];
          if (serviceInstance && serviceInstance.isRemote()) {
            // Only remote probed service has the ability to add provider.
            serviceInstance.addProvider(data);
          }
        });
      });
    }

    return promise;
  },

  registerService: function(name, serviceInstance) {
    this.services[name] = serviceInstance;
  }
};
