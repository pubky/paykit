const { test } = require('brittle')
const sinon = require('sinon')

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

const bolt11Alice = require('../bolt11.js').init(configAlice)
const bolt11Bob = require('../bolt11.js').init(configBob)

test('e2e - amount', async (t) => {
  const amount = 10
  const notificationCallbackAlice = sinon.fake()

  await bolt11Alice.receivePayment({ amount, notificationCallback: notificationCallbackAlice })

  t.is(notificationCallbackAlice.callCount, 1)
  const resAlice = notificationCallbackAlice.getCall(0).args[0]
  t.is(resAlice.type, 'ready_to_receive')
  t.is(resAlice.pluginName, 'bolt11')
  t.is(resAlice.amountWasSpecified, true)
  t.ok(resAlice.data.bolt11)

  const invoice = resAlice.data.bolt11

  const notificationCallbackBob = sinon.fake()
  await bolt11Bob.pay({
    target: invoice,
    payload: { id: '321', orderId: '123' },
    notificationCallback: notificationCallbackBob
  })

  t.is(notificationCallbackBob.callCount, 1)
  const resBob = notificationCallbackBob.getCall(0).args[0]
  t.is(resBob.pluginName, 'bolt11')
  t.is(resBob.pluginState, 'success')
  t.is(resBob.id, '321')
  t.is(resBob.orderId, '123')
  t.absent(resBob.rawData.error)
  t.ok(Date.parse(resBob.rawData.data.confirmed_at) < Date.now())
  t.ok(resBob.rawData.data.id)
  t.ok(resBob.rawData.data.is_confirmed)
  t.ok(resBob.rawData.data.is_outgoing)
  t.is(resBob.rawData.data.mtokens, (amount * 1000).toString())
  t.ok(resBob.rawData.data.paths)
  t.ok(resBob.rawData.data.secret)
  t.ok(resBob.rawData.data.tokens, amount)

  t.is(notificationCallbackAlice.callCount, 2)
  const notificationAlice = notificationCallbackAlice.getCall(1).args[0]

  t.is(notificationAlice.type, 'payment_new')
  t.is(notificationAlice.pluginName, 'bolt11')
  t.is(notificationAlice.amountWasSpecified, true)
  t.ok(notificationAlice.rawData)
  t.is(notificationAlice.amount, amount.toString())
  t.is(notificationAlice.denomination, 'BASE')
  t.is(notificationAlice.currency, 'BTC')
  t.is(typeof notificationAlice.memo, 'string')
  t.is(notificationAlice.clientOrderId, notificationAlice.rawData.id)
  t.ok(Date.parse(notificationAlice.createdAt) <= Date.parse(notificationAlice.confirmedAt))
  t.ok(Date.parse(notificationAlice.confirmedAt) <= Date.now())

  t.teardown(() => {
    sinon.restore()
  })
})

test('e2e - no amount', async (t) => {
  const notificationCallbackAlice = sinon.fake()
  const amount = 11

  await bolt11Alice.receivePayment({ notificationCallback: notificationCallbackAlice })

  t.is(notificationCallbackAlice.callCount, 1)
  const resAlice = notificationCallbackAlice.getCall(0).args[0]
  t.is(resAlice.type, 'ready_to_receive')
  t.is(resAlice.pluginName, 'bolt11')
  t.is(resAlice.amountWasSpecified, false)
  t.ok(resAlice.data.bolt11)

  const invoice = notificationCallbackAlice.getCall(0).args[0].data.bolt11

  const notificationCallbackBob = sinon.fake()
  await bolt11Bob.pay({
    target: { bolt11: invoice },
    payload: {
      id: '321',
      amount
    },
    notificationCallback: notificationCallbackBob,
  })

  t.is(notificationCallbackBob.callCount, 1)
  const resBob = notificationCallbackBob.getCall(0).args[0]
  t.is(resBob.pluginName, 'bolt11')
  t.is(resBob.pluginState, 'success')
  t.is(resBob.id, '321')
  t.absent(resBob.rawData.error)
  t.ok(Date.parse(resBob.rawData.data.confirmed_at) < Date.now())
  t.ok(resBob.rawData.data.id)
  t.ok(resBob.rawData.data.is_confirmed)
  t.ok(resBob.rawData.data.is_outgoing)
  t.is(resBob.rawData.data.mtokens, (amount * 1000).toString())
  t.ok(resBob.rawData.data.paths)
  t.ok(resBob.rawData.data.secret)
  t.ok(resBob.rawData.data.tokens, amount)

  t.is(notificationCallbackAlice.callCount, 2)
  const notificationAlice = notificationCallbackAlice.getCall(1).args[0]
  t.is(notificationAlice.type, 'payment_new')
  t.is(notificationAlice.pluginName, 'bolt11')
  t.is(notificationAlice.amountWasSpecified, false)
  t.ok(notificationAlice.rawData)
  t.is(notificationAlice.amount, amount.toString())
  t.is(notificationAlice.denomination, 'BASE')
  t.is(notificationAlice.currency, 'BTC')
  t.is(typeof notificationAlice.memo, 'string')
  t.is(notificationAlice.clientOrderId, notificationAlice.rawData.id)
  t.ok(Date.parse(notificationAlice.createdAt) <= Date.parse(notificationAlice.confirmedAt))
  t.ok(Date.parse(notificationAlice.confirmedAt) <= Date.now())

  t.teardown(() => {
    sinon.restore()
  })
})
