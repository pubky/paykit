const { test } = require('brittle')

const { PaymentManager } = require('../../src/payments/PaymentManager')

const { tmpdir } = require('../helpers')

const { Relay } = require('@synonymdev/web-relay')

const bolt11 = require('../../plugins/btc-l1-l2-lnd/bolt11.js')
const onchain = require('../../plugins/btc-l1-l2-lnd/onchain.js')

test('e2e', async (t) => {
  const relay = new Relay(tmpdir())
  relay.listen(3000)

  const configAlice = require('../../examples/.configA.js')

  const configA = {
    sendingPriority: ['bolt11', 'onchain'],
    plugins: { bolt11, onchain },
    bolt11: configAlice.plugin,
    onchain: configAlice.plugin
  }

  const paymentManagerA = new PaymentManager({
    config: {
      slashpay: configA,
      db: { name: 'test', path: './test_dba' },
      transport: {
        storage: tmpdir(),
        relay: 'http://localhost:3000'
      }
    },
    notificationCallback: (p) => console.log('Receiver:', p)
  })

  await paymentManagerA.init() // receiver
  const url = await paymentManagerA.receivePayments()

  // ---------------------------------------------------------------------------------
  const configBob = require('../../examples/.configB.js')

  const configB = {
    sendingPriority: ['bolt11', 'onchain'],
    plugins: { bolt11, onchain },
    bolt11: configBob.plugin,
    onchain: configBob.plugin
  }

  const paymentManagerB = new PaymentManager({
    config: {
      slashpay: configB,
      db: { name: 'test', path: './test_dbb' },
      transport: {
        storage: tmpdir(),
        relay: 'http://localhost:3000'
      }
    },
    notificationCallback: (p) => console.log('Sender:', p)
  })
  await paymentManagerB.init() // sender

  const paymentOrder = await paymentManagerB.createPaymentOrder({
    clientOrderId: 'e2e-test-123',
    amount: '1000',
    sendingPriority: [
      'bolt11',
      'onchain'
    ],
    counterpartyURL: url
  })

  await paymentManagerB.sendPayment(paymentOrder.id)

  t.teardown(async () => {
    await relay.close()
  })
})
