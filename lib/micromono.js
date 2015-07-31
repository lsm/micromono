/**
 * Module dependencies
 */

var path = require('path');
var async = require('async');
var Asset = require('./asset');
var Service = require('./service');
var isArray = require('lodash.isarray');
var discovery = require('./discovery');
var Farcaster = require('./farcaster');
var spawnSync = require('child_process').spawnSync;
var singletonify = require('./helper').singletonify;
var partialRender = require('./render');


/**
 * Parse commmand line arguments
 */
var argv = require('minimist')(process.argv);
var SERVICE = argv.service;
var SERVICE_DIR = argv['service-dir'];
var ALLOW_PENDING = argv['allow-pending'];


/**
 * Object for holding pending services
 */
var pendingServices = {};


/**
 * Constructor for MicroMono class
 *
 * @return {MicroMono} Instance of MicroMono class
 */
var MicroMono = module.exports = function MicroMono(options) {
  this.options = this.getDefaultOptions(options);
  this.services = {};
  if (SERVICE) {
    var services = SERVICE.split(',');
    // load services required from command line
    services.forEach(function(name) {
      this.require(name);
    }, this);
  }

  if (ALLOW_PENDING) {
    setInterval(function() {
      var services = Object.keys(pendingServices);
      if (services.length > 0) {
        console.log('Pending service(s): %s', services.join(', '));
      }
    }, 2000);
  }
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
      var expectedMessage = 'Cannot find module \'' + package + '\'';
      if (e.code !== 'MODULE_NOT_FOUND' || e.message !== expectedMessage) {
        // throw error if we found the module which contains error.
        throw e;
      }
      var probedResult = spawnSync('node', [require.resolve('./prober'), package]);
      if (probedResult.status !== 0) {
        if (ALLOW_PENDING && probedResult.status === 100) {
          // probe timeout, save the name to pending services and continue
          ServiceClass = pendingServices[package] = Service;
        } else {
          throw new Error(probedResult.stderr.toString());
        }
      } else {
        var serviceInfo = JSON.parse(probedResult.stdout);
        console.log('New service `%s` probed from network.', serviceInfo.name);
        console.log(serviceInfo);
        ServiceClass = Farcaster.build(serviceInfo);
      }
    }

    var ServiceFactory;

    if (ServiceClass === Service) {
      ServiceFactory = Service;
    } else {
      ServiceFactory = singletonify(ServiceClass);
      this.registerService(package, ServiceFactory);
    }

    return ServiceFactory;
  },

  /**
   * @param  {Function} [app] Instance of express application
   * @return {Promise}
   */
  boot: function(app) {
    if (typeof app === 'function') {
      if (app.prototype.isRemote) {
        var Service = app;
        var service = new Service();
        this.registerService(service.announcement.name, service);
        app = null;
      } else if (app.get('views')) {
        app.use(partialRender(app));
      }
    } else if (typeof app === 'string') {
      this.require(app);
      app = null;
    } else if (isArray(app)) {
      app.forEach(function(package) {
        this.require(package);
      }, this);
      app = null;
    }

    var self = this;
    var services = this.services;
    this.getPackageInfo(this.options.packagePath);
    var asset = this.asset;

    var promise = asset.configJSPM()
      .then(function() {
        return new Promise(function(resolve, reject) {
          async.each(Object.keys(services), function runService(name, callback) {
            var serviceInstance = services[name];
            if (typeof serviceInstance === 'function') {
              var ServiceFactory = serviceInstance;
              serviceInstance = new ServiceFactory();
              self.registerService(name, serviceInstance);
            }
            asset.mergeJSPMDeps(serviceInstance.announcement.client);
            var p = serviceInstance.run(app);
            if (!app) {
              p = p.then(function() {
                discovery.announce(serviceInstance.announcement);
              });
            }
            p.then(callback).catch(callback);
          }, function bootServicesFinished(err) {
            err ? reject(err) : resolve();
          });
        });
      });

    if (app) {
      // assume we are in the server mode
      promise = promise.then(function() {
        discovery.listen(function(err, data, rinfo) {
          if (data && data.name) {
            var serviceName = data.name;
            var serviceInstance = services[serviceName];
            if (pendingServices[serviceName]) {
              // Found pending service
              var ServiceClass = self.require(serviceName);
              var ServiceFactory = singletonify(ServiceClass);
              serviceInstance = new ServiceFactory();
              self.registerService(serviceName, serviceInstance);
              delete pendingServices[serviceName];
            } else if (serviceInstance && serviceInstance.isRemote()) {
              // Only remote probed service has the ability to add provider.
              serviceInstance.addProvider(data);
            }
          }
        });
      });

      if (asset.publicURL && asset.publicPath) {
        // serve local asset files
        promise = promise.then(function() {
          app.use(asset.publicURL, require('express').static(asset.publicPath));
        });
      }
    }

    return promise;
  },

  registerService: function(name, serviceInstance) {
    this.services[name] = serviceInstance;
  }
};
