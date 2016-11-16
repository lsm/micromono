
exports.default = [
  ['-d --service-dir [dir]', 'Directory of locally available services. Env name: MICROMONO_SERVICE_DIR'],
  ['-p --port [port]', 'The http port which balancer/service binds to. MICROMONO_PORT'],
  ['-H --host [host]', 'The host which balancer/service binds to. MICROMONO_HOST']
]

exports.discovery = [
  // Default options for discovery
  ['--discovery-target [service]', 'The target service to be discovered. MICROMONO_DISCOVERY_TARGET'],
  ['--discovery-backend [backend]',
    'The backend of service discovery. Default `udp`. MICROMONO_DISCOVERY_BACKEND', 'udp'],
  ['--discovery-timeout [timeout]',
    'The discoverying process will exit out after this time. Default 90 seconds. MICROMONO_DISCOVERY_TIMEOUT', '90000'
  ],
  ['--discovery-announce-interval [interval]',
    'The interval between sending out announcements. MICROMONO_DISCOVERY_ANNOUNCE_INTERVAL', '3000'],
  // Agent settings
  ['--discovery-agent',
    'Run micromono service/server in discovery agent mode. MICROMONO_DISCOVERY_AGENT'],
  ['--discovery-agent-path [/path/to/agent]',
    'Use the indicated executable as discovery prober instead of the default one. MICROMONO_DISCOVERY_AGENT_PATH'],
  // UDP address
  ['--discovery-udp-address [address]',
    'Multicast address of udp network. MICROMONO_DISCOVERY_UDP_ADDRESS', '224.0.0.116'],
  ['--discovery-udp-port [port]',
    'Port for udp socket to bind to. MICROMONO_DISCOVERY_UDP_PORT', '11628'],
  // NATS
  ['--discovery-nats-servers [servers]',
    'Comma separated list of nats server adresses. MICROMONO_DISCOVERY_NATS_SERVERS']
]

exports.server = [
  ['-s --services [services]',
    'Names of services to require. Use comma to separate multiple services. (e.g. --services account,cache) Env name: MICROMONO_SERVICES'],
  ['--local-services [services]', 'List of local services required.'],
  ['--remote-services [services]', 'List of remote services required.']
]

exports.service = [
  ['-r --rpc [type]', 'Type of rpc to use. Default `socketmq`. MICROMONO_RPC', 'socketmq'],
  ['--rpc-port [port]', 'The port which service binds the rpc server to. MICROMONO_RPC_PORT'],
  ['--rpc-host [host]', 'The host which service binds the rpc server to. MICROMONO_RPC_HOST'],
  ['--chn-endpoint', 'The endpoint [protocol]://[address]:[port] which channel server binds to. MICROMONO_CHN_ENDPOINT']
]
