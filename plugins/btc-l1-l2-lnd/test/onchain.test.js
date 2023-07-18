const { test } = require('brittle')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const { LndConnect } = require('../LndConnect.js')

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

const onchainAlice = proxyquire('../onchain.js', {
  './config.js': configAlice
})

const onchainBob = proxyquire('../onchain.js', {
  './config.js': configBob
})

test('e2e', async (t) => {
  t.timeout(60000)
  t.plan(22)

  let address

  const notificationCallbackAlice = (payload) => {
    if (payload.type === 'ready_to_recieve') {
      t.is(payload.pluginName, 'onchain')
      t.is(payload.amountWasSpecified, false)
      t.ok(payload.data)
      address = payload.data.p2wpkh
    } else if (payload.type === 'payment_new') {
      t.is(payload.pluginName, 'onchain')
      t.is(payload.amountWasSpecified, false)
      t.ok(payload.data)

      t.ok(payload.data.orderId)
      t.absent(payload.data.error)
      t.ok(payload.data.data)
      t.ok(Date.parse(payload.data.timestamp) <= new Date())

      t.pass()
    } else {
      console.log(payload)
      t.fail()
    }
  }
  const amount = 1000

  await onchainAlice.watch({ notificationCallback: notificationCallbackAlice })

  const notificationCallbackBob = sinon.fake()
  await onchainBob.pay({
    address,
    notificationCallback: notificationCallbackBob,
    amount
  })

  t.is(notificationCallbackBob.callCount, 1)
  const resBob = notificationCallbackBob.getCall(0).args[0] 
  t.is(resBob.type, '') // XXX ?
  t.is(resBob.pluginName, 'onchain')
  t.is(resBob.pluginState, 'success')
  t.ok(resBob.data.id)
  t.absent(resBob.data.error)
  t.ok(resBob.data.data.confirmation_count >= 0)
  t.ok(resBob.data.data.id)
  t.ok(resBob.data.data.is_confirmed == !!resBob.data.data.confirmation_count)
  t.ok(resBob.data.data.is_outgoing)
  t.is(resBob.data.data.tokens, amount)

  t.teardown(() => {
    sinon.restore()
  })
})

