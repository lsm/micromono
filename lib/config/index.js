var cmdenv = require('cmdenv')
var settings = require('./settings')

module.exports = function(configs) {
  var config = cmdenv('micromono').allowUnknownOption()
  configs.forEach(function(name) {
    var setting = settings[name]
    if (name) {
      setting.forEach(function(option) {
        config.option(option[0], option[1], option[2])
      })
    }
  })
  return config.parse(process.argv)
}
