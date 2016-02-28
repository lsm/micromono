/**
 * Parse commmand line and environment options
 */
module.exports = require('cmdenv')('micromono')
  .allowUnknownOption()
  .option('-d --service-dir [dir]', 'Directory of locally available services. Env name: MICROMONO_SERVICE_DIR')
  .option('-p --port [port]', 'The http port which balancer/service binds to.')
  .option('-H --host [host]', 'The host which balancer/service binds to.')
  .option('-r --rpc [type]', 'Type of rpc to use.', 'socketmq')
  .option('--rpc-port [port]', 'The port which service binds the rpc server to.')
  .option('--rpc-host [host]', 'The host which service binds the rpc server to.')
