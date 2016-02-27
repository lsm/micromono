var jspm = require('./jspm')
var pjson = require('./pjson')
var bundle = require('./bundle')
var assign = require('lodash.assign')


module.exports = assign({}, jspm, pjson, bundle)
