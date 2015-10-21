/**
 * Announcement module.
 * The main purpose of this module is to define a spec for services.
 */

var Announcement = module.exports = function(service) {
  this.use = service.use
  this.name = service.name
  this.version = service.version
  this.baseUrl = service.baseUrl
  this.upgradeUrl = service.upgradeUrl
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
 * Path of the service package
 * @type {String}
 * @required
 */
Announcement.prototype.packagePath = undefined

/**
 * Name of the framework
 * @type {String}
 * @optional
 */
Announcement.prototype.framework = undefined

/**
 * Base url for web requests include route, upgrade, middleware but not for asset
 *
 * @type {String}
 * @optional
 */
Announcement.prototype.baseUrl = undefined

/**
 * Define endpoint which accepts upgrade request (websockets).
 *
 * @type {String}
 * @optional
 */
Announcement.prototype.upgradeUrl = undefined

/**
 * The route definition object.
 * @type {Object}
 * @optional
 */
Announcement.prototype.route = undefined

/**
 * The balancer middleware rules.
 * @type {Object}
 * @optional
 */
Announcement.prototype.use = undefined

/**
 * Defines what middleware this service provides.
 * @type {Object}
 * @optional
 */
Announcement.prototype.middleware = undefined

/**
 * The info of client side resources.
 * @type {Object}
 * @optional
 */
Announcement.prototype.asset = undefined

/**
 * The rpc definition object.
 * @type {Object}
 * @optional
 */
Announcement.prototype.rpc = undefined
