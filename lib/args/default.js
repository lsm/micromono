/**
 * Parse commmand line and environment options
 */
module.exports = require('cmdenv')('micromono')
  .allowUnknownOption()
  .option('-d --service-dir [dir]', 'Directory of locally available services. Env name: MICROMONO_SERVICE_DIR')
  .option('-p --port [port]', 'The http port which balancer/service binds to. MICROMONO_PORT')
  .option('-H --host [host]', 'The host which balancer/service binds to. MICROMONO_HOST')
