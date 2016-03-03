module.exports = require('./default')
  .option('--discovery-backend [backend]',
    'The backend of service discovery. MICROMONO_DISCOVERY_BACKEND', 'udp')
  .option('--discovery-udp-multicast [address]',
    'Multicast address of udp network. MICROMONO_DISCOVERY_UDP_MULTICAST', '224.0.0.116')
  .option('--discovery-udp-port [port]',
    'Port for udp socket to bind to. MICROMONO_DISCOVERY_UDP_PORT', '11628')
