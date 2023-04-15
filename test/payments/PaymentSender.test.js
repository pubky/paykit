const sinon = require('sinon')
const { test } = require('brittle')

const { DB } = require('../fixtures/db')
const db = new DB()

const { Storage } = require('../fixtures/externalStorage')
const remoteStorage = new Storage()

const { PluginManager } = require('../../src/pluginManager')
const { pluginConfig } = require('../fixtures/config.js')

const { paymentParams } = require('../fixtures/paymentParams')

const { PaymentSender } = require('../../src/payments/PaymentSender')
const { Payment } = require('../../src/payments/Payment')

test('PaymentSender', async t => {
  const payment = new Payment(paymentParams)
  await payment.init(remoteStorage, ['p2sh', 'p2tr'])
  const paymentSender = new PaymentSender(payment, db, () => {})

  t.alike(paymentSender.db, db)
  t.alike(paymentSender.payment, payment)
  t.alike(paymentSender.notificationCallback.toString(), '() => {}')
})

test('PaymentSender.submit', async t => {
  const pluginManager = new PluginManager(pluginConfig)

  const payment = new Payment(paymentParams)
  await payment.init(remoteStorage, ['p2sh', 'p2tr'])
  const dbSavePayment = sinon.replace(db, 'updatePayment', sinon.fake(db.updatePayment))
  const paymentSender = new PaymentSender(payment, db, () => {})

  await paymentSender.submit(pluginManager)

  t.is(dbSavePayment.callCount, 1)

  t.teardown(() => {
    sinon.restore()
  })
})

test('PaymentSender.forward', async t => {
  const pluginManager = new PluginManager(pluginConfig)

  const payment = new Payment(paymentParams)
  await payment.init(remoteStorage, ['p2sh', 'p2tr'])
  const paymentSender = new PaymentSender(payment, db, () => {})

  await paymentSender.forward(pluginManager, 'p2sh', paymentParams)
})

test('PaymentSender.stateUpdateCallback', async t => {
  const pluginManager = new PluginManager(pluginConfig)

  const payment = new Payment(paymentParams)
  await payment.init(remoteStorage, ['p2sh', 'p2tr'])
  const dbSavePayment = sinon.replace(db, 'updatePayment', sinon.fake(db.updatePayment))
  const paymentSender = new PaymentSender(payment, db, () => {})

  await paymentSender.submit(pluginManager)

  await paymentSender.stateUpdateCallback('p2sh', { state: 'pending' })

  t.is(dbSavePayment.callCount, 2)

  t.teardown(() => {
    sinon.restore()
  })
})
