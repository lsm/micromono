/**
 * cmdenv.js - a utility which merges environmental variables with command line options
 */

var env = process.env;
var commander = require('commander');
var parse = commander.parse.bind(commander);

var cmdenv = module.exports = function(prefix) {
  var _prefix;
  if (prefix && 'string' === typeof prefix) {
    _prefix = prefix.toUpperCase();
  }

  commander.parse = function(argv) {
    var result = parse(argv);

    if (result.options.length > 0) {
      // get value from env if it is not presented in command line options
      result.options.forEach(function(opt) {
        if (opt.long) {
          var optEnvName;
          var optLongName = opt.long.slice(2);
          optLongName = optLongName.split('-');

          if (optLongName.length > 1) {
            optLongName = optLongName.map(function(name, idx) {
              if (idx > 0) {
                name = name[0].toUpperCase() + name.slice(1);
              }
              return name;
            });
          }

          optEnvName = optLongName.join('_').toUpperCase();
          optLongName = optLongName.join('');

          var envName = (_prefix ? _prefix + '_' : '') + optEnvName;

          if ('undefined' === typeof result[optLongName] && env[envName]) {
            result[optLongName] = env[envName];
          }
        }
      });
    }

    return result;
  };

  return commander;
};


// example usage
if (require.main === module) {
  var result = cmdenv('ib')
    .option('-m --mongodb')
    .option('-r --redis-server')
    .parse(process.argv);
  console.log(result);
}

