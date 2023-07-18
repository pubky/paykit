const { test } = require('brittle')
const createTestnet = require('@hyperswarm/testnet')
const proxyquire = require('proxyquire')

const { SlashtagsConnector, SLASHPAY_PATH } = require('../../src/slashtags')
const { PaymentManager } = require('../../src/payments/PaymentManager')
const { DB } = require('../../src/DB') // mocked

test('e2e', async (t) => {
  const testnet = await createTestnet(3, t)

  const configAlice = {
    CERT: '/Users/dz/.polar/networks/1/volumes/lnd/alice/tls.cert',
    MACAROON: '/Users/dz/.polar/networks/1/volumes/lnd/alice/data/chain/bitcoin/regtest/admin.macaroon',
    SOCKET: '127.0.0.1:10007',
    SUPPORTED_METHODS: ['bolt11', 'p2wpkh'],
    URL_PREFIX: 'slashpay:'
  }

  const bolt11Alice = proxyquire('../../plugins/btc-l1-l2-lnd/bolt11.js', {
    './config.js': configAlice
  })

  const onchainAlice = proxyquire('../../plugins/btc-l1-l2-lnd/onchain.js', {
    './config.js': configAlice
  })

  const configA = {
    sendingPriority: [
      'bolt11',
      'onchain',
    ],
    plugins: {
      bolt11: bolt11Alice, // inject instead of require
      onchain: onchainAlice, // inject instead of require
    },
    // something else?
  }

  const slashtagsConnectorA = new SlashtagsConnector(testnet)
  await slashtagsConnectorA.init()

  const dbA = new DB()
  await dbA.init()
  const paymentManagerA = new PaymentManager(
    configA,
    dbA,
    slashtagsConnectorA,
    (p) => console.log('A:', p)
  )

  //---------------------------------------------------------------------------------
  const configBob = {
    CERT: '/Users/dz/.polar/networks/1/volumes/lnd/bob/tls.cert',
    MACAROON: '/Users/dz/.polar/networks/1/volumes/lnd/bob/data/chain/bitcoin/regtest/admin.macaroon',
    SOCKET: '127.0.0.1:10010',
    SUPPORTED_METHODS: ['bolt11', 'p2wpkh'],
    URL_PREFIX: 'slashpay:'
  }

  const bolt11Bob = proxyquire('../../plugins/btc-l1-l2-lnd/bolt11.js', {
    './config.js': configBob
  })

  const onchainBob = proxyquire('../../plugins/btc-l1-l2-lnd/onchain.js', {
    './config.js': configBob
  })

  const configB = {
    sendingPriority: [
      'bolt11',
      'onchain',
    ],
    plugins: {
      bolt11: bolt11Bob, // inject instead of require
      onchain: onchainBob, // inject instead of require
    },
    // something else?
  }

  const slashtagsConnectorB = new SlashtagsConnector(testnet)
  await slashtagsConnectorB.init()

  const dbB = new DB()
  await dbB.init()

  const paymentManagerB = new PaymentManager(
    configB,
    dbB,
    slashtagsConnectorB,
    (p) => console.log('B:', p)
  )


  await paymentManagerA.init() // receiver
  await paymentManagerB.init() // sender

  const url = await paymentManagerA.receivePayments()

  const foo = new SlashtagsConnector(testnet)
  await foo.init()
  const res = await foo.readRemote(url)

  const boltRes = await foo.readRemote(url.split('/')[0] + res.paymentEndpoints.bolt11)
  const onchainRes = await foo.readRemote(url.split('/')[0] + res.paymentEndpoints.onchain)

  const paymentOrder = await paymentManagerB.createPaymentOrder({
    clientOrderId: 'e2e-test-123',
    amount: '1000',
    sendingPriority: [ 'bolt11', 'onchain' ],
    counterpartyURL: url,
  })

  await paymentManagerB.sendPayment(paymentOrder.id)

  t.teardown(async () => {
    await foo.close()
    await slashtagsConnectorA.close()
    await slashtagsConnectorB.close()
  })

})
