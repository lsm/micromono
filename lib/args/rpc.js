module.exports = require('./default')
  .option('-r --rpc [type]', 'Type of rpc to use. MICROMONO_RPC', 'socketmq')
  .option('--rpc-port [port]', 'The port which service binds the rpc server to. MICROMONO_RPC_PORT')
  .option('--rpc-host [host]', 'The host which service binds the rpc server to. MICROMONO_RPC_HOST')
