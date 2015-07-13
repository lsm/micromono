/**
 * Module dependencies
 */

var path = require('path');
var async = require('async');
var Asset = require('./asset');
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
   * @param  {Function} app Instance of express application
   * @return {Promise}
   */
  boot: function(app) {
    var self = this;
    var services = this.services;
    this.getPackageInfo(this.options.packagePath);


    if (app && app.get('views')) {
      app.use(function(req, res, next) {
        var _write = res.write;
        var _writeHead = res.writeHead;

        var header;
        res.writeHead = function(code, message, headers) {
          header = [code, message, headers];
          if (code === 304) {
            res.write = _write;
            _writeHead.apply(res, header);
          }
          return res;
        };

        res.write = function(body) {
          if (!/^text\/html/.test(res.get('Content-Type'))) {
            _writeHead.apply(res, header);
            _write.call(res, body);
            return res;
          }

          if (!/<html\b[^>]*>/.test(body)) {
            // the response is html code but it is not a full page
            // render it with template
            app.render('layout', {
              'yield': body,
              'name': 'xxx'
            }, function(err, html) {
              if (err) {
                var data = err.toString();
                res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
                _writeHead.call(res, 500, 'MicroMono rendering error.');
                _write.call(res, data);
                return;
              }
              res.set('Content-Length', Buffer.byteLength(html, 'utf-8'));
              _writeHead.call(res, header[0]);
              _write.call(res, html);
            });
          } else {
            _writeHead.apply(res, header);
            _write.call(res, body);
          }

          return res;
        };

        next();
      });
    }

    var promise = self.asset.configJSPM()
      .then(function() {
        if (self.asset.jspmInfo && app) {
          self.asset.express(app);
        }
      })
      .then(function() {
        return new Promise(function(resolve, reject) {
          async.each(Object.keys(services), function runService(name, callback) {
            var serviceInstance = services[name];
            if (typeof serviceInstance === 'function') {
              serviceInstance = new serviceInstance();
              services[name] = serviceInstance;
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
