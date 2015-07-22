/**
 * Serivce discovery script. Used as proxy for probing network services upon
 * composer startup. E.g. micromono.require('some-service');
 */

/**
 * Module dependencies
 */
var Discovery = require('./discovery');

function found(data, exitCode) {
  if (exitCode === 0) {
    process.stdout.write(JSON.stringify(data), function() {
      process.exit(0);
    });
  } else {
    process.stderr.write(data, function() {
      process.exit(exitCode);
    });
  }
}

var serviceName = process.argv[2];
var timer = setTimeout(function() {
  found('Probing timeout, can not locate service remotely: ' + serviceName, 1);
}, 2000);

Discovery.listen(function(err, data, rInfo) {
  if (data && data.name === serviceName) {
    clearTimeout(timer);
    found(data, 0);
  }
});
