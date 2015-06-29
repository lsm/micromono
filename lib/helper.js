var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
/**
 * [getFnArgs description]
 * @param  {Function} fn [description]
 * @return {[type]}      [description]
 */
exports.getFnArgs = function getFnArgs(fn) {
  return fn.toString().replace(STRIP_COMMENTS, '').match(FN_ARGS)[1].replace(/[\t\s\r\n]+/mg, '').split(',');
};
