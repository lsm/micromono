var argv = require('cmdenv')('micromono')

/**
 * Parse commmand line and environment options
 */
argv
  .allowUnknownOption()
  .option('-s --service [services]', 'Names of services to require. Use comma to separate multiple services. (e.g. --service account,cache) Env name: MICROMONO_SERVICE')
  .option('-d --service-dir [dir]', 'Directory of locally available services. Env name: MICROMONO_SERVICE_DIR')
  .option('-p --port [port]', 'The http port which balancer/service binds to.')
  .option('-H --host [host]', 'The host which balancer/service binds to.')
  .option('-r --rpc [type]', 'Type of rpc to use.', 'axon')
  .option('--rpc-port [port]', 'The port which service binds the rpc server to.')
  .option('--rpc-host [host]', 'The host which service binds the rpc server to.')
  .option('-b --bundle-asset', 'Bundle production ready version of asset files.')

module.exports = argv
