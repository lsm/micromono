/**
 * Module dependencies.
 */

var zmq = require('zmq');
var path = require('path');
var Asset = require('./asset');
var extend = require('ampersand-class-extend');
var toArray = require('lodash.toarray');
var Discovery = require('./discovery');
var randomPort = require('random-port');


/**
 * Module constants
 */

var NODE_ENV = process.env.NODE_ENV;
var RPC_PORT_RANGE = {
  from: 16262,
  range: 10000
};
var ASSET_PORT_RANGE = {
  from: 36262,
  range: 10000
};


/**
 * MicroMono Service class constructor.
 * // @todo we need a singleton constructor
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

  this.announcement.route = getRouteInfo(this);
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

  serveAsset: function(host) {
    if (!this.asset) {
      return Promise.resolve();
    }

    var self = this;
    var asset = this.asset;
    var promise = NODE_ENV === 'production' ? asset.bundle() : Promise.resolve();

    promise.then(function() {
      return self.getRandomPort(ASSET_PORT_RANGE).then(function(port) {
        return asset.startServer(port, host);
      });
    });

    return promise;
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

  run: function() {
    var self = this;
    var promise = this.init ? this.init() : Promise.resolve();

    promise
      .then(this.serveAsset.bind(this))
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
            Discovery.announce(ann);

            resolve(socket);
          });
        });
      });

    return promise;
  }
};

/**
 * MicroMonoService private API.
 */


/**
 * Take a service instance and generate the routes info.
 *
 * @param  {Service} service Instance of MicroMonoService.
 * @return {Object}         Array of routes information in following format:
 *     {
 *       'get::/hello/:name': {
 *         name: 'get::/hello/:name',
 *         method: 'get',
 *         path: '/hello:/:name',
 *         args: ['name', 'callback'],
 *         handler: function (name, callback) {
 *           // function body
 *           ...
 *         }
 *       },
 *       // more routes
 *       ...
 *     }
 */
function getRouteInfo(service) {
  var _routes = {};

  if (service.routes) {
    var routes = service.routes;

    Object.keys(routes).forEach(function(routePath) {
      var _route = formatRoutePath(routePath);
      var routeHandler = routes[routePath];

      if (typeof routeHandler === 'string') {
        routeHandler = service[routeHandler];
      }

      if (typeof routeHandler !== 'function') {
        throw new Error('Route handler for path ' + routePath + ' is not a function.');
      }

      var args = getFnArgs(routeHandler);
      _route.handler = routeHandler;
      _route.args = args;

      _routes[routePath] = _route;
    });
  }

  return _routes;
}

/**
 * [formatRoutePath description]
 * @param  {[type]} routePath [description]
 * @return {Object}           Route definition object
 */
function formatRoutePath(routePath) {
  var _route = {};
  if (typeof routePath === 'string') {
    var _path = routePath.split('::');
    var method = 'get';
    if (_path.length === 2) {
      method = _path[0];
      _path = _path[1];
    } else {
      _path = routePath;
    }
    _route = {
      name: routePath,
      method: method,
      path: _path
    };
  }
  return _route;
}

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
/**
 * [getFnArgs description]
 * @param  {Function} fn [description]
 * @return {[type]}      [description]
 */
function getFnArgs(fn) {
  return fn.toString().replace(STRIP_COMMENTS, '').match(FN_ARGS)[1].replace(/[\t\s\r\n]+/mg, '').split(',');
}

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
