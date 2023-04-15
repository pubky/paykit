const sinon = require('sinon')
const { test } = require('brittle')

const { DB } = require('../fixtures/db')
const db = new DB()

const { paymentParams } = require('../fixtures/paymentParams')
const { paymentConfig } = require('../fixtures/config')
const { Storage } = require('../fixtures/externalStorage')
const storage = new Storage()

const { PaymentFactory, ERROR } = require('../../src/payments/PaymentFactory')

test('PaymentFactory.getOrCreatePayment - payment exists', async t => {
  const dbGetPayment = sinon.replace(
    db,
    'getPayment',
    sinon.fake.returns({
      id: 'paymentId',
      currency: 'BTC',
      denomination: 'BASE',
      ready: true,
      sentWith: [],
      ...paymentParams

    })
  )
  const dbSavePayment = sinon.replace(db, 'savePayment', sinon.fake(db.savePayment))

  const paymentFactory = new PaymentFactory(db, paymentConfig)

  const payment = await paymentFactory.getOrCreatePayment({ clientPaymentId: 'clientPaymentId' })
  t.is(dbGetPayment.callCount, 1)

  t.is(payment.id, 'paymentId')
  t.is(payment.clientPaymentId, 'clientPaymentId')
  t.is(payment.amount, '100')
  t.is(payment.currency, 'BTC')
  t.is(payment.denomination, 'BASE')
  t.is(payment.target, 'slashpay://driveKey/slashpay.json')
  t.is(payment.ready, true)
  t.alike(payment.sentWith, [])

  t.is(dbSavePayment.callCount, 0)
  t.teardown(() => {
    sinon.restore()
  })
})

test('PaymentFactory.createNewPayment - missing storage', async t => {
  const paymentFactory = new PaymentFactory(db, paymentConfig)

  await t.exception(async () => await paymentFactory.createNewPayment(paymentParams), ERROR.MISSING_STORAGE)
})

test('PaymentFactory.createNewPayment', async t => {
  const dbSavePayment = sinon.replace(db, 'savePayment', sinon.fake(db.savePayment))

  const paymentFactory = new PaymentFactory(db, paymentConfig)
  const payment = await paymentFactory.createNewPayment(paymentParams, storage)

  t.is(payment.id, 'totally-random-id')
  t.is(payment.clientPaymentId, 'clientPaymentId')
  t.is(payment.amount, '100')
  t.is(payment.currency, 'BTC')
  t.is(payment.denomination, 'BASE')
  t.is(payment.target, 'slashpay://driveKey/slashpay.json')
  t.is(payment.ready, true)
  t.alike(payment.sentWith, [])

  t.is(dbSavePayment.callCount, 1)
  t.alike(dbSavePayment.args[0], [payment])
  t.teardown(() => {
    sinon.restore()
  })
})

test('PaymentFactory.getOrCreatePayment - payment does not exist', async t => {
  const dbGetPayment = sinon.replace(db, 'getPayment', sinon.fake.returns(null))
  const dbSavePayment = sinon.replace(db, 'savePayment', sinon.fake(db.savePayment))

  const paymentFactory = new PaymentFactory(db, paymentConfig)

  const payment = await paymentFactory.getOrCreatePayment(paymentParams, storage)
  t.is(dbGetPayment.callCount, 1)

  t.is(payment.id, 'totally-random-id')
  t.is(payment.clientPaymentId, 'clientPaymentId')
  t.is(payment.amount, '100')
  t.is(payment.currency, 'BTC')
  t.is(payment.denomination, 'BASE')
  t.is(payment.target, 'slashpay://driveKey/slashpay.json')
  t.is(payment.ready, true)
  t.alike(payment.sentWith, [])

  t.is(dbSavePayment.callCount, 1)
  t.alike(dbSavePayment.args[0], [payment])
  t.teardown(() => {
    sinon.restore()
  })
})
