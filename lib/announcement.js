/**
 * Announcement module.
 * The main purpose of this module is to define a spec for services.
 */

var Announcement = module.exports = function(service) {
  this.name = service.name
  this.version = service.version
}

/**
 * Name of the service
 * @type {String}
 * @required
 */
Announcement.prototype.name = undefined

/**
 * Version of the service
 * @type {String}
 * @required
 */
Announcement.prototype.version = undefined

/**
 * The info of client side resources.
 * @type {Object}
 * @optional
 */
Announcement.prototype.asset = undefined

/**
 * Web related information
 * @type {Object}
 * @optional
 */
Announcement.prototype.web = {
  /**
   * Middleware used on the balancer side.
   * @type {Object}
   * @optional
   */
  use: undefined,

  /**
   * The route definition object.
   * @type {Object}
   * @optional
   */
  route: undefined,

  /**
   * Name of the framework
   * @type {String}
   * @optional
   */
  framework: undefined,

  /**
   * Defines what middleware this service provides.
   * @type {Object}
   * @optional
   */
  middleware: undefined,

  /**
   * Define endpoint which accepts upgrade request (websockets).
   *
   * @type {String}
   * @optional
   */
  upgradeUrl: undefined
}

/**
 * The rpc definition object.
 * @type {Object}
 * @optional
 */
Announcement.prototype.rpc = undefined
