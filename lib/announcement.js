/**
 * Announcement module.
 * The main purpose of this module is to define a spec for services.
 */

var Announcement = module.exports = function(service) {
  this.name = service.name
  this.version = service.version
  delete this.web
}

/**
 * Name of the service
 *
 * @type {String}
 * @required
 */
Announcement.prototype.name = undefined

/**
 * Version of the service
 *
 * @type {String}
 * @required
 */
Announcement.prototype.version = undefined

/**
 * Info of client side resources.
 *
 * @type {Object}
 * @optional
 */
Announcement.prototype.asset = undefined

/**
 * Web related information. The value assigned is for documentation only.
 *
 * @type {Object}
 * @optional
 */
Announcement.prototype.web = {

  /**
   * Port of the http(s) server binds to.
   * @type {Number}
   * @required
   */
  port: undefined,

  /**
   * Host of the http(s) server binds to.
   * @type {Number}
   * @required
   */
  host: undefined,

  /**
   * Middleware used on the balancer side.
   *
   * @type {Object}
   * @optional
   */
  use: undefined,

  /**
   * The route definition object.
   *
   * @type {Object}
   * @optional
   */
  route: undefined,

  /**
   * Name of the framework.
   *
   * @type {String}
   * @optional
   */
  framework: undefined,

  /**
   * Defines what middleware this service provides.
   *
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
 * The API definition object.
 *
 * @type {Object}
 * @optional
 */
Announcement.prototype.api = undefined

/**
 * The channel definition object.
 *
 * @type {Object}
 * @optional
 */
Announcement.prototype.channel = undefined
