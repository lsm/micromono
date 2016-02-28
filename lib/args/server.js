
module.exports = require('./default')
  .option('-s --service [services]', 'Names of services to require. Use comma to separate multiple services. (e.g. --service account,cache) Env name: MICROMONO_SERVICE')
  .option('--local-services [services]', 'List of local services required.')
  .option('--remote-services [services]', 'List of remote services required.')
