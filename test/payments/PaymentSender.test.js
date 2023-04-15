const sinon = require('sinon')
const { test, skip } = require('brittle')

const { DB } = require('../fixtures/db')
const db = new DB()

const storage = require('../fixtures/storageInstance')

const { Storage } = require('../fixtures/externalStorage')
const remoteStorage = new Storage()

const { PluginManager } = require('../../src/pluginManager')
const { pluginConfig } = require('../fixtures/config.js')
const pluginManager = new PluginManager()
;(async () => await pluginManager.loadPlugin(pluginConfig.plugins[0], storage))()

const { paymentParams } = require('../fixtures/paymentParams')

const { PaymentSender } = require('../../src/payments/PaymentSender')
const { Payment } = require('../../src/payments/Payment')

test('PaymentSender', async t => {
  const payment = new Payment(paymentParams)
  await payment.init(remoteStorage, ['p2sh', 'p2tr'])
  const paymentSender = new PaymentSender(pluginManager, payment, db, () => {})

  t.alike(paymentSender.pluginManager, pluginManager)
  t.alike(paymentSender.db, db)
  t.alike(paymentSender.payment, payment)
  t.alike(paymentSender.notificationCallback.toString(), '() => {}')
})

skip('PaymentSender.submit', async t => {
  const payment = new Payment(paymentParams)
  await payment.init(remoteStorage, ['p2sh', 'p2tr'])
  const dbSavePayment = sinon.replace(db, 'updatePayment', sinon.fake(db.updatePayment))

  const paymentSender = new PaymentSender(pluginManager, payment, db, () => {})

  const pluginDispatch = sinon.replace(pluginManager, 'dispatchEvent', sinon.fake(pluginManager.dispatchEvent))

  await paymentSender.submit()

  t.is(pluginDispatch.callCount, 1)
  t.is(paymentSender.payment.processingPluging, '../fixtures/p2sh/main.js')
  t.is(dbSavePayment.callCount, 1)

  t.teardown(() => {
    sinon.restore()
  })
})

skip('PaymentSender.forward', async t => { })

skip('PaymentSender.stateUpdateCallback', async t => { })
