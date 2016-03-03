module.exports = require('./default')
  .option('--discovery-backend [backend]',
    'The backend of service discovery. MICROMONO_DISCOVERY_BACKEND', 'udp')
  // UDP multicast
  .option('--discovery-udp-multicast [address]',
    'Multicast address of udp network. MICROMONO_DISCOVERY_UDP_MULTICAST', '224.0.0.116')
  .option('--discovery-udp-port [port]',
    'Port for udp socket to bind to. MICROMONO_DISCOVERY_UDP_PORT', '11628')
  // NATS
  .option('--discovery-nats-servers [servers]. MICROMONO_DISCOVERY_NATS_SERVERS')