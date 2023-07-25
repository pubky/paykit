const { test } = require('brittle')
const sinon = require('sinon')

const configAlice = {
  CERT: '/Users/dz/.polar/networks/1/volumes/lnd/alice/tls.cert',
  MACAROON: '/Users/dz/.polar/networks/1/volumes/lnd/alice/data/chain/bitcoin/regtest/admin.macaroon',
  SOCKET: '127.0.0.1:10007',
  SUPPORTED_METHODS: ['p2wpkh'],
  URL_PREFIX: 'slashpay:'
}

const configBob = {
  CERT: '/Users/dz/.polar/networks/1/volumes/lnd/bob/tls.cert',
  MACAROON: '/Users/dz/.polar/networks/1/volumes/lnd/bob/data/chain/bitcoin/regtest/admin.macaroon',
  SOCKET: '127.0.0.1:10010',
  SUPPORTED_METHODS: ['p2wpkh', 'p2sh', 'p2pkh'],
  URL_PREFIX: 'slashpay:'
}

const onchainAlice = require('../onchain.js').init(configAlice)
const onchainBob = require('../onchain.js').init(configBob)

test('e2e', async (t) => {
  t.timeout(60000)
  t.plan(18)

  let address

  const notificationCallbackAlice = (payload) => {
    if (payload.type === 'ready_to_receive') {
      t.is(payload.pluginName, 'onchain')
      t.is(payload.amountWasSpecified, false)
      t.ok(payload.data)
      address = payload.data.p2wpkh
    } else if (payload.type === 'payment_new') {
      t.is(payload.pluginName, 'onchain')
      t.is(payload.amountWasSpecified, false)
      t.ok(payload.rawData)
      t.ok(payload.clientOrderId)
      t.pass()
    } else {
      t.fail()
    }
  }
  const amount = 1000

  await onchainAlice.receivePayment({ notificationCallback: notificationCallbackAlice })

  const notificationCallbackBob = sinon.fake()
  await onchainBob.pay({
    target: address,
    notificationCallback: notificationCallbackBob,
    payload: {
      id: '123',
      amount
    }
  })

  t.is(notificationCallbackBob.callCount, 1)
  const resBob = notificationCallbackBob.getCall(0).args[0]
  t.is(resBob.pluginName, 'onchain')
  t.is(resBob.pluginState, 'success')
  t.ok(resBob.data.id)
  t.absent(resBob.data.error)
  t.ok(resBob.data.data.confirmation_count >= 0)
  t.ok(resBob.data.data.id)
  t.ok(resBob.data.data.is_confirmed === !!resBob.data.data.confirmation_count)
  t.ok(resBob.data.data.is_outgoing)
  t.is(resBob.data.data.tokens, amount)

  t.teardown(() => {
    sinon.restore()
  })
})
