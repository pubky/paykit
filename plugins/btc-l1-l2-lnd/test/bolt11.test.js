const { test } = require('brittle')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const configAlice = {
  CERT: '/Users/dz/.polar/networks/1/volumes/lnd/alice/tls.cert',
  MACAROON: '/Users/dz/.polar/networks/1/volumes/lnd/alice/data/chain/bitcoin/regtest/admin.macaroon',
  SOCKET: '127.0.0.1:10007',
  SUPPORTED_METHODS: ['bolt11', 'p2wpkh'],
  URL_PREFIX: 'slashpay:'
}

const configBob = {
  CERT: '/Users/dz/.polar/networks/1/volumes/lnd/bob/tls.cert',
  MACAROON: '/Users/dz/.polar/networks/1/volumes/lnd/bob/data/chain/bitcoin/regtest/admin.macaroon',
  SOCKET: '127.0.0.1:10010',
  SUPPORTED_METHODS: ['bolt11', 'p2wpkh', 'p2sh', 'p2pkh'],
  URL_PREFIX: 'slashpay:'
}

const bolt11Alice = proxyquire('../bolt11.js', {
  './config.js': configAlice
})

const bolt11Bob = proxyquire('../bolt11.js', {
  './config.js': configBob
})

test('e2e - amount', async (t) => {
  const amount = 10
  const notificationCallbackAlice = sinon.fake()

  await bolt11Alice.watch({ amount, notificationCallback: notificationCallbackAlice })

  t.is(notificationCallbackAlice.callCount, 1)
  const resAlice = notificationCallbackAlice.getCall(0).args[0]
  t.is(resAlice.type, 'ready_to_recieve')
  t.is(resAlice.pluginName, 'bolt11')
  t.is(resAlice.amountWasSpecified, true)
  t.ok(resAlice.data.bolt11)

  const invoice = notificationCallbackAlice.getCall(0).args[0].data.bolt11

  const notificationCallbackBob = sinon.fake()
  await bolt11Bob.pay({ bolt11: invoice, notificationCallback: notificationCallbackBob })

  t.is(notificationCallbackBob.callCount, 1)
  const resBob = notificationCallbackBob.getCall(0).args[0]
  t.is(resBob.type, '') // XXX ?
  t.is(resBob.pluginName, 'bolt11')
  t.is(resBob.pluginState, 'success')
  t.ok(resBob.data.id)
  t.absent(resBob.data.error)
  t.ok(Date.parse(resBob.data.data.confirmed_at) < Date.now())
  t.ok(resBob.data.data.id)
  t.ok(resBob.data.data.is_confirmed)
  t.ok(resBob.data.data.is_outgoing)
  t.is(resBob.data.data.mtokens, (amount * 1000).toString())
  t.ok(resBob.data.data.paths)
  t.ok(resBob.data.data.secret)
  t.ok(resBob.data.data.tokens, amount)

  t.is(notificationCallbackAlice.callCount, 2)
  const notificationAlice = notificationCallbackAlice.getCall(1).args[0]
  t.is(notificationAlice.type, 'payment_new')
  t.is(notificationAlice.pluginName, 'bolt11')
  t.is(notificationAlice.amountWasSpecified, true)
  t.ok(notificationAlice.data.orderId)
  t.ok(notificationAlice.data.data.id)
  t.is(notificationAlice.data.data.sats, amount)
  t.is(notificationAlice.data.data.description, '')
  t.is(notificationAlice.data.error, false)
  t.ok(Date.parse(notificationAlice.data.timestamp) < Date.now())

  t.teardown(() => {
    sinon.restore()
  })
})

test('e2e - no amount', async (t) => {
  const notificationCallbackAlice = sinon.fake()
  const amount = 11

  await bolt11Alice.watch({ notificationCallback: notificationCallbackAlice })

  t.is(notificationCallbackAlice.callCount, 1)
  const resAlice = notificationCallbackAlice.getCall(0).args[0]
  t.is(resAlice.type, 'ready_to_recieve')
  t.is(resAlice.pluginName, 'bolt11')
  t.is(resAlice.amountWasSpecified, false)
  t.ok(resAlice.data.bolt11)

  const invoice = notificationCallbackAlice.getCall(0).args[0].data.bolt11

  const notificationCallbackBob = sinon.fake()
  await bolt11Bob.pay({
    bolt11: invoice,
    notificationCallback: notificationCallbackBob,
    amount
  })

  t.is(notificationCallbackBob.callCount, 1)
  const resBob = notificationCallbackBob.getCall(0).args[0]
  t.is(resBob.type, '') // XXX ?
  t.is(resBob.pluginName, 'bolt11')
  t.is(resBob.pluginState, 'success')
  t.ok(resBob.data.id)
  t.absent(resBob.data.error)
  t.ok(Date.parse(resBob.data.data.confirmed_at) < Date.now())
  t.ok(resBob.data.data.id)
  t.ok(resBob.data.data.is_confirmed)
  t.ok(resBob.data.data.is_outgoing)
  t.is(resBob.data.data.mtokens, (amount * 1000).toString())
  t.ok(resBob.data.data.paths)
  t.ok(resBob.data.data.secret)
  t.ok(resBob.data.data.tokens, amount)

  t.is(notificationCallbackAlice.callCount, 2)
  const notificationAlice = notificationCallbackAlice.getCall(1).args[0]
  t.is(notificationAlice.type, 'payment_new')
  t.is(notificationAlice.pluginName, 'bolt11')
  t.is(notificationAlice.amountWasSpecified, false)
  t.ok(notificationAlice.data.orderId)
  t.ok(notificationAlice.data.data.id)
  t.is(notificationAlice.data.data.sats, amount)
  t.is(notificationAlice.data.data.description, '')
  t.is(notificationAlice.data.error, false)
  t.ok(Date.parse(notificationAlice.data.timestamp) < Date.now())

  t.teardown(() => {
    sinon.restore()
  })
})
