var debug = require('debug')
var LOG_LEVEL = process.env.MICROMONO_LOG_LEVEL || 'info'
var DEFAULT_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace']

/**
 * Export constructor with default settings.
 * @type {Function}
 */
exports = module.exports = createLogger(LOG_LEVEL, DEFAULT_LEVELS)


/**
 * Export constructor creator for customized usage.
 * @type {Function}
 */
exports.createLogger = createLogger


/**
 * The constructor creator.
 * @param  {String} DEFAULT_LEVEL Default level of logging if not supplied.
 * @param  {Array}  LEVELS        Levels of logging.
 * @return {Logger}               The Logger constructor.
 */
function createLogger(DEFAULT_LEVEL, LEVELS) {
  LEVELS = LEVELS || DEFAULT_LEVELS
  return function Logger(namespace, level) {
    level = level || DEFAULT_LEVEL
    var levelIdx = LEVELS.indexOf(level)
    var logger = {}

    LEVELS.forEach(function(lv, idx) {
      if (levelIdx >= idx) {
        var ns = namespace ? (namespace + ':' + lv) : lv
        var log = debug(ns)
        logger[lv] = function() {
          log.apply(null, arguments)
          return logger
        }
      } else {
        logger[lv] = function() {
          return logger
        }
      }
    })

    return logger
  }
}
