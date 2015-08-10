/**
 * Module dependencies.
 */

var path = require('path');
var Asset = require('./asset');
var debug = require('debug')('micromono:service');
var Router = require('./router');
var assign = require('lodash.assign');
var extend = require('ampersand-class-extend');
var express = require('express');
var getFnArgs = require('./helper').getFnArgs;
var randomPort = require('random-port');
var EventEmitter = require('eventemitter3');


/**
 * Module constants
 */

var RPC_PORT_RANGE = {
  from: 16262,
  range: 10000
};
var WEB_PORT_RANGE = {
  from: 36262,
  range: 10000
};


/**
 * MicroMono Service class constructor.
 */
var Service = module.exports = function MicroMonoService() {
  if (!this.packagePath) {
    throw new Error('Please provide `packagePath` property when you extend Service class');
  }

  var packagePath = this.packagePath;
  this.packageInfo = require(path.join(packagePath, 'package.json'));

  this.emitter = new EventEmitter();

  this.announcement = {
    name: this.packageInfo.name,
    version: this.packageInfo.version
  };

  if (this.packageInfo.jspm) {
    // found jspm info, initialize Asset
    this.asset = new Asset(this.packagePath);
    this.announcement.client = this.asset.parseJSPM();
  }

  if (this.route || this.asset || this.middleware) {
    var router = new Router(this);
    this.router = router;
    this.app = router.routeApp;
  }

  this.baseUrl = this.baseUrl || '/';
  this.announcement.baseUrl = this.baseUrl;

  var api = getAPIInfo(this);
  if (Object.keys(api).length > 0) {
    this.announcement.api = api;
    assign(this, require('./rpc/socket.io').server);
  }

  if (!this.init) {
    this.init = function() {
      return Promise.resolve();
    };
  }
};

// Provide the ability to extend the Service class.
Service.extend = extend;

/**
 * MicroMono Service public API.
 *
 * @type {Object}
 */
Service.prototype = {

  isRemote: function() {
    return false;
  },

  express: function(app) {
    var router = this.router;

    if (router) {
      if (router.assetApp) {
        app.use(router.assetApp);
      }

      if (router.routeApp) {
        app.use(this.baseUrl, router.routeApp);
      }

      if (router.middlewareApp) {
        app.use(router.middlewareApp);
      }
    }
  },

  on: function(event, callback) {
    if (event === 'server') {
      if (this.server) {
        return callback(this.server);
      }
    }

    this.emitter.on(event, callback);
  },

  setHttpServer: function(server) {
    this.server = server;
    this.emitter.emit('server', server);
  },

  allowUpgrade: function(path) {
    this.announcement.allowUpgrade = path;
  },

  startWebServer: function(host) {
    if (!this.asset && !this.router) {
      // no need to start http server if we don't have asset or route to serve.
      return Promise.resolve();
    }

    if (typeof host === 'function') {
      // host is an express instance, the main app
      this.mainApp = host;
      this.express(host);
      // we don't need to call the listen function since it will be handled externally
      return Promise.resolve();
    }

    var self = this;
    return this.getRandomPort(WEB_PORT_RANGE).then(function(port) {
      var mainApp = express();
      self.express(mainApp);
      self.mainApp = mainApp;
      self.announcement.webPort = port;

      var promise = new Promise(function(resolve, reject) {
        self.server = mainApp.listen(port, host, function(error) {
          error ? reject(error) : resolve();
        });
        self.setHttpServer(self.server);
      });

      return promise;
    });
  },

  getRandomPort: function(range) {
    range = range || RPC_PORT_RANGE;
    var promise = new Promise(function(resolve, reject) {
      randomPort(range, function(port) {
        resolve(port);
      });
    });
    return promise;
  },

  encodeData: function(data) {
    return JSON.stringify(data);
  },

  decodeData: function(msg) {
    return JSON.parse(msg);
  },

  getHandler: function(name) {
    return this.announcement.api[name].handler;
  },

  run: function(app) {
    var self = this;

    var promise = this.startWebServer(app)
      .then(function() {
        return self.init();
      })
      .then(function() {
        if (self.router) {
          // load route handlers
          self.announcement.route = self.router.getRoutes();
          self.announcement.middleware = self.router.getMiddlewares();
        }
      })
      .then(function() {
        if (self.announcement.api) {
          return self.getRandomPort().then(function(port) {
            return self.startRPCServer(port);
          });
        }
      })
      .then(function() {
        debug('Service "%s" started with following service info: ', self.announcement.name);
        debug(self.announcement);
      });

    return promise;
  }
};

/**
 * MicroMonoService private functions.
 */

var API_BLACK_LIST = ['constructor', 'init', 'app'].concat(Object.keys(Service.prototype));

/**
 * [getAPIInfo description]
 * @return {Object} [description]
 */
function getAPIInfo(service) {
  var _apis = {};
  for (var name in service) {
    if (API_BLACK_LIST.indexOf(name) === -1 && name[0] !== '_') {
      var fn = service[name];
      if (typeof fn === 'function') {
        var args = getFnArgs(fn);
        _apis[name] = {
          name: name,
          args: args,
          handler: fn
        };
      }
    }
  }
  return _apis;
}
