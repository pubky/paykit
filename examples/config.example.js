module.exports = {
  db: {
    name: 'paykit',
    path: './paykit_db'
  },
  slashtags: {
    relay: 'http://localhost:3000'
  },
  slashpay: {
    sendingPriority: ['bolt11', 'onchain'],
    plugins: {
      bolt11: require('../plugins/btc-l1-l2-lnd/bolt11.js'),
      onchain: require('../plugins/btc-l1-l2-lnd/onchain.js'),
    },
    bolt11: {
      CERT: '<path to lnd cerd>'
      MACAROON: '<path to lnd macaroon>',
      SOCKET: '127.0.0.1:10001',
    },
    onchain: {
      CERT: '<path to lnd cerd>'
      MACAROON: '<path to lnd macaroon>',
      SOCKET: 'http://localhost:10001',
    }
  }
}
