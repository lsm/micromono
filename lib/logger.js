var debug = require('debug')
var LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace']
var LOG_LEVEL = process.env.MICROMONO_LOG_LEVEL || 'info'


module.exports = function(namespace, level) {
  level = level || LOG_LEVEL
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
