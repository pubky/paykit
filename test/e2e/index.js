const { test } = require('brittle')
const createTestnet = require('@hyperswarm/testnet')

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

  const bolt11Alice = require('../../plugins/btc-l1-l2-lnd/bolt11.js')
  const onchainAlice = require('../../plugins/btc-l1-l2-lnd/onchain.js')

  const configA = {
    sendingPriority: [
      'bolt11',
      'onchain'
    ],
    plugins: {
      bolt11: bolt11Alice,
      onchain: onchainAlice
    },
    bolt11: configAlice,
    onchain: configAlice
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

  // ---------------------------------------------------------------------------------
  const configBob = {
    CERT: '/Users/dz/.polar/networks/1/volumes/lnd/bob/tls.cert',
    MACAROON: '/Users/dz/.polar/networks/1/volumes/lnd/bob/data/chain/bitcoin/regtest/admin.macaroon',
    SOCKET: '127.0.0.1:10010',
    SUPPORTED_METHODS: ['bolt11', 'p2wpkh'],
    URL_PREFIX: 'slashpay:'
  }

  const bolt11Bob = require('../../plugins/btc-l1-l2-lnd/bolt11.js')
  const onchainBob = require('../../plugins/btc-l1-l2-lnd/onchain.js')

  const configB = {
    sendingPriority: [
      'bolt11',
      'onchain'
    ],
    plugins: {
      bolt11: bolt11Bob,
      onchain: onchainBob
    },
    bolt11: configBob,
    onchain: configBob
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

  const paymentOrder = await paymentManagerB.createPaymentOrder({
    clientOrderId: 'e2e-test-123',
    amount: '1000',
    sendingPriority: [
      'bolt11',
      'onchain',
    ],
    counterpartyURL: url
  })

  await paymentManagerB.sendPayment(paymentOrder.id)

  t.teardown(async () => {
    // XXX: stop plugins shutting down the subscriptions to addresses and invoices
    await slashtagsConnectorA.close()
    await slashtagsConnectorB.close()
  })
})
