/**
 * Module dependencies
 */
var extend = require('ampersand-class-extend');

/**
 * MicroMono service constructor
 */
function MicroMonoService() {

}

/**
 * MicroMono public api.
 *
 * @type {Object}
 */
MicroMonoService.prototype = {

  /**
   * Format and return routes information for the service
   * @return {Object}
   */
  route: function() {
    return formatRoutes(this.routes);
  },

  /**
   * Format and return api information for the service
   * @return {Object}
   */
  api: function() {

  }

};

/**
 * MicroMonoService private api.
 */

function formatRoutes(routes) {
  var _routes = Object.keys(routes).map(function(routePath) {

  });

  return _routes;
}

function formatAPIs() {

}



MicroMonoService.extend = extend;

module.exports = MicroMonoService;
