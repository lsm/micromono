/**
 * Module dependencies.
 */

var zmq = require('zmq');
var path = require('path');
var Asset = require('./asset');
var Router = require('./router');
var extend = require('ampersand-class-extend');
var express = require('express');
var toArray = require('lodash.toarray');
var getFnArgs = require('./helper').getFnArgs;
var discovery = require('./discovery');
var randomPort = require('random-port');
var serveStatic = require('serve-static');


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

  this.announcement = {
    name: this.packageInfo.name,
    version: this.packageInfo.version
  };

  if (this.packageInfo.jspm) {
    // found jspm info, initialize Asset
    this.asset = new Asset(this.packagePath);
    this.asset.parseJSPM();
    this.announcement.client = this.asset.jspmInfo;
  }

  if (this.routes) {
    var router = new Router(this);
    this.router = router;
    this.announcement.route = router.getRoutes();
  }

  this.baseUrl = this.baseUrl || '/';
  this.announcement.baseUrl = this.baseUrl;

  this.announcement.api = getAPIInfo(this);
};

// Provide the ability to extend the Service class.
Service.extend = extend;

/**
 * MicroMono Service public API.
 *
 * @type {Object}
 */
Service.prototype = {

  express: function(app) {
    if (this.asset) {
      // use express app to serve asset
      app.use(this.asset.publicURL, serveStatic(this.asset.publicPath));
    }

    if (this.router) {
      // mount router to express instance
      var subApp = this.router.getExpressApp();
      this.app = subApp;
      app.use(this.baseUrl || '/', subApp);
    }
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
        mainApp.listen(port, host, function(error) {
          error ? reject(error) : resolve();
        });
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
    var ann = this.announcement;
    var handler = (ann.route[name] || ann.api[name]).handler;
    return handler;
  },

  /**
   * Dispatch message to local route/api handler
   *
   * @param  {String} msg      A JSON string with following properties:
   *                           {
   *                             // when there's callback in the function signature
   *                             cid: 'Vk7HgAGv',
   *                             // name of the route or api
   *                             name: 'get::/blog/create', // or 'createPost'
   *                             // input arguments for the route/api
   *                             // A callback will be generated and
   *                             // pushed to the end of `args` if `cid` exists
   *                             args: ['this', 'is', 'data'],
   *
   *                           }
   * @param  {String} envelope String identity of the sending client
   */
  dispatch: function(msg, envelope) {
    var data = this.decodeData(msg);
    var args = data.args || [];
    var handler = this.getHandler(data.name);
    var self = this;

    if (data.cid) {
      var callback = function() {
        var _args = toArray(arguments);
        var _data = {
          cid: data.cid,
          args: _args
        };
        self.socket.send([envelope, self.encodeData(_data)]);
      };
      args.push(callback);
    }

    handler.apply(this, args);
  },

  run: function(app) {
    var self = this;
    var promise = this.startWebServer(app);

    promise
      .then(function() {
        if (self.init) {
          return self.init();
        } else {
          return Promise.resolve();
        }
      })
      .then(this.getRandomPort)
      .then(function(port) {
        var _port = 'tcp://0.0.0.0:' + port;
        var socket = zmq.socket('router');
        var ann = self.announcement;
        ann.port = port;
        socket.identity = ann.name + '::' + _port;
        self.socket = socket;

        return new Promise(function(resolve, reject) {
          socket.bind(_port, function(err) {
            if (err) {
              return reject(err);
            }

            socket.on('message', function(envelope, msg) {
              self.dispatch(msg, envelope);
            });

            console.log('Service %s started, begin boradcasting service info: ', ann.name);
            console.log(ann);
            discovery.announce(ann);

            resolve();
          });
        });
      });

    return promise;
  }
};

/**
 * MicroMonoService private functions.
 */

var API_BLACK_LIST = ['constructor', 'init'].concat(Object.keys(Service.prototype));

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
