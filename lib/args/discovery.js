module.exports = require('./default')
  .option('--discovery-backend [backend]',
    'The backend of service discovery. MICROMONO_DISCOVERY_BACKEND', 'udp')
  .option('--discovery-interval [interval]',
    'The backend of service discovery. MICROMONO_DISCOVERY_INTERVAL', '1000')
  // UDP multicast
  .option('--discovery-udp-multicast [address]',
    'Multicast address of udp network. MICROMONO_DISCOVERY_UDP_MULTICAST')
  .option('--discovery-udp-port [port]',
    'Port for udp socket to bind to. MICROMONO_DISCOVERY_UDP_PORT')
  // NATS
  .option('--discovery-nats-servers [servers]. MICROMONO_DISCOVERY_NATS_SERVERS')
