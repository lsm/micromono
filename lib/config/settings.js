
exports.default = [
  ['-d --service-dir [dir]', 'Directory of locally available services. Env name: MICROMONO_SERVICE_DIR'],
  ['-p --port [port]', 'The http port which balancer/service binds to. MICROMONO_PORT'],
  ['-H --host [host]', 'The host which balancer/service binds to. MICROMONO_HOST']
]

exports.discovery = [
  ['--discovery-backend [backend]',
    'The backend of service discovery. MICROMONO_DISCOVERY_BACKEND', 'udp'],
  ['--discovery-interval [interval]',
    'The backend of service discovery. MICROMONO_DISCOVERY_INTERVAL', '1000'],
  // UDP multicast
  ['--discovery-udp-multicast [address]',
    'Multicast address of udp network. MICROMONO_DISCOVERY_UDP_MULTICAST'],
  ['--discovery-udp-port [port]',
    'Port for udp socket to bind to. MICROMONO_DISCOVERY_UDP_PORT'],
  // NATS
  ['--discovery-nats-servers [servers]. MICROMONO_DISCOVERY_NATS_SERVERS']
]

exports.server = [
  ['-s --services [services]', 'Names of services to require. Use comma to separate multiple services. (e.g. --services account,cache) Env name: MICROMONO_SERVICES'],
  ['--local-services [services]', 'List of local services required.'],
  ['--remote-services [services]', 'List of remote services required.']
]

exports.service = [
  ['-r --rpc [type]', 'Type of rpc to use. MICROMONO_RPC', 'socketmq'],
  ['--rpc-port [port]', 'The port which service binds the rpc server to. MICROMONO_RPC_PORT'],
  ['--rpc-host [host]', 'The host which service binds the rpc server to. MICROMONO_RPC_HOST'],
  ['--chn-endpoint', 'The endpoint [protocol]://[address]:[port] which channel server binds to. MICROMONO_CHN_ENDPOINT']
]
