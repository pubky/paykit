const sinon = require('sinon')
const { test } = require('brittle')

const { Storage } = require('../fixtures/externalStorage')
const storage = new Storage()

const { paymentParams } = require('../fixtures/paymentParams')

const { Payment, PAYMENT_STATE, ERROR } = require('../../src/payments/Payment')

test('Payment', t => {
  const payment = new Payment(paymentParams)

  t.is(payment.id, 'totally-random-id')
  t.is(payment.clientPaymentId, 'clientPaymentId')
  t.is(payment.amount, '100')
  t.is(payment.currency, 'BTC')
  t.is(payment.denomination, 'BASE')
  t.is(payment.target, 'slashpay://driveKey/slashpay.json')
  t.is(payment.internalState, PAYMENT_STATE.INITIAL)
  t.alike(payment.sentWith, [])
  t.is(payment.ready, false)
})

test('Payment.validatePaymentObject', t => {
  t.exception(() => Payment.validatePaymentObject({}), ERROR.CLIENT_ID_REQUIRED)
  t.exception(() => Payment.validatePaymentObject({ clientPaymentId: 'clientPaymentId' }), ERROR.AMOUNT_REQUIRED)
  t.exception(() => Payment.validatePaymentObject({ clientPaymentId: 'clientPaymentId', amount: '100' }), ERROR.TARGET_REQUIRED)
})

test('Payment.generateId', t => {
  t.is(Payment.generateId(), 'totally-random-id')
})

test('Payment.init - no remote storage', async t => {
  const payment = new Payment(paymentParams)

  await t.exception(async () => await payment.init(), ERROR.NO_REMOTE_STORAGE)
})

test('Payment.init - no sending priority', async t => {
  const payment = new Payment(paymentParams)

  await t.exception(async () => await payment.init(storage), ERROR.NO_SENDING_PRIORITY)
})


test('Payment.init - no matching plugins', async t => {
  const storageInit = sinon.replace(storage, 'init', sinon.fake(storage.init))
  const storageGetPaymentFile = sinon.replace(storage, 'getPaymentFile', sinon.fake(storage.getPaymentFile))

  const payment = new Payment(paymentParams)

  await t.exception(
    async () => await payment.init(storage, ['paypal', 'visa']),
    ERROR.NO_MATCHING_PLUGINS
  )
  t.is(payment.ready, false)
  t.is(storageInit.callCount, 1)
  t.alike(storageInit.args[0], ['slashpay://driveKey/slashpay.json'])
  t.is(storageGetPaymentFile.callCount, 1)
  t.alike(storageGetPaymentFile.args[0], [])
  t.teardown(() => {
    sinon.restore()
  })
})

test('Payment.init - success', async t => {
  const storageInit = sinon.replace(storage, 'init', sinon.fake(storage.init))
  const storageGetPaymentFile = sinon.replace(storage, 'getPaymentFile', sinon.fake(storage.getPaymentFile))

  const payment = new Payment(paymentParams)

  await payment.init(storage, ['p2sh', 'lightning'])

  t.alike(payment.sendingPriority, ['p2sh', 'lightning'])
  t.is(payment.ready, true)
  t.is(storageInit.callCount, 1)
  t.alike(storageInit.args[0], ['slashpay://driveKey/slashpay.json'])
  t.is(storageGetPaymentFile.callCount, 1)
  t.alike(storageGetPaymentFile.args[0], [])
  t.teardown(() => {
    sinon.restore()
  })
})
