/**
 * Module dependencies
 */

var path = require('path');
var async = require('async');
var Asset = require('./asset');
var debug = require('debug')('micromono');
var express = require('express');
var Service = require('./service');
var discovery = require('./discovery');
var Farcaster = require('./farcaster');
var spawnSync = require('child_process').spawnSync;
var singletonify = require('./helper').singletonify;


/**
 * Parse commmand line arguments
 */
var argv = require('minimist')(process.argv);
var SERVICE = argv.service;
var SERVICE_DIR = argv['service-dir'];
var ALLOW_PENDING = argv['allow-pending'];
var PORT = process.env.PORT;


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
  this.instances = {};

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
      if (this.services[package]) {
        ServiceClass = this.services[package];
      } else {
        ServiceClass = require(package);
      }
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
        debug('New service `%s` probed from network.', serviceInfo.name);
        debug(serviceInfo);
        ServiceClass = Farcaster.build(serviceInfo);
      }
    }

    var ServiceFactory;

    if (ServiceClass === Service) {
      ServiceFactory = Service;
    } else {
      ServiceFactory = this.registerService(ServiceClass, package);
    }

    return ServiceFactory;
  },

  startService: function(ServiceClass) {
    if (typeof ServiceClass === 'function' && ServiceClass.prototype.isRemote) {
      this.registerService(ServiceClass);
    }

    return runServices(this);
  },

  runServer: function(app) {
    if (SERVICE) {
      var services = SERVICE.split(',');
      // load services required from command line
      services.forEach(function(name) {
        this.require(name);
      }, this);
    }

    var self = this;
    var _app = app ? app : express();

    // monkey patch listen to get the server instance
    var listen = _app.listen;
    _app.listen = function() {
      self.server = listen.apply(_app, arguments);
      // assign the server object to all service instances
      Object.keys(self.instances).forEach(function(name) {
        var serviceInstance = self.instances[name];
        serviceInstance.setHttpServer(self.server);
      });
    };

    this.getPackageInfo(this.options.packagePath);
    var asset = this.asset;

    var promise = asset.configJSPM().then(function() {
      return runServices(self, _app);
    });

    if (asset.publicURL && asset.publicPath) {
      // serve local asset files
      promise = promise.then(function() {
        _app.use(asset.publicURL, require('express').static(asset.publicPath));
      });
    }

    return promise.then(function() {
        if (!app) {
          // no express app is provided, we need to listen by ourselves.
          _app.listen(PORT);
        }
      })
      .then(function() {
        // listen for new providers for existing or pending services
        discovery.listen(function(err, data, rinfo) {
          if (data && data.name) {
            var serviceName = data.name;
            if (pendingServices[serviceName]) {
              // Found pending service
              var ServiceClass = self.require(serviceName);
              var ServiceFactory = self.registerService(ServiceClass, serviceName);
              delete pendingServices[serviceName];
              // initialize and run the service
              runService(self, _app, ServiceFactory);
            } else {
              var serviceInstance = self.instances[serviceName];
              if (serviceInstance && serviceInstance.isRemote()) {
                // Only remote probed service has the ability to add provider.
                serviceInstance.addProvider(data);
              }
            }
          }
        });
      });
  },

  registerService: function(ServiceClass, name) {
    var ServiceFactory = singletonify(ServiceClass);
    if (!name) {
      var serviceInstance = new ServiceFactory();
      name = serviceInstance.announcement.name;
      this.instances[name] = serviceInstance;
    }
    this.services[name] = ServiceFactory;
    return ServiceFactory;
  }
};

/**
 * MicroMono private functions
 */

function runServices(micromono, app) {
  var services = micromono.services;

  return new Promise(function(resolve, reject) {
    async.each(Object.keys(services), function(name, callback) {
      var ServiceFactory = services[name];
      runService(micromono, app, ServiceFactory, function(promise, serviceInstance) {
        // only announce when we are running as a service in standalone process
        if (!app && !serviceInstance.isRemote()) {
          promise = promise.then(function() {
            discovery.announce(serviceInstance.announcement);
          });
        }
        promise.then(callback).catch(callback);
      });
    }, function bootServicesFinished(err) {
      err ? reject(err) : resolve();
    });
  });
}

function runService(micromono, app, ServiceFactory, callback) {
  var serviceInstance = new ServiceFactory();
  var ann = serviceInstance.announcement;
  micromono.instances[ann.name] = serviceInstance;
  if (micromono.asset) {
    micromono.asset.mergeJSPMDeps(ann.client);
  }
  var promise = serviceInstance.run(app).then(function() {
    if (ann.use) {
      Object.keys(ann.use).forEach(function(key) {
        var name = ann.use[key];
        var middleware = require('./middleware/' + name);
        serviceInstance.app.use(key, middleware(app));
      });
    }
  });
  callback && callback(promise, serviceInstance);
  return promise;
}
