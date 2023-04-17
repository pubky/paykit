const sinon = require('sinon')
const { test } = require('brittle')

const { DB } = require('../fixtures/db')
const db = new DB()

const storage = require('../fixtures/storageInstance')

const { PluginManager } = require('../../src/pluginManager')

const { pluginConfig } = require('../fixtures/config.js')

const pluginManager = new PluginManager()
;(async () => await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage))()

const { PaymentReceiver } = require('../../src/payments/PaymentReceiver')

test('PaymentReceiver', t => {
  const paymentReceiver = new PaymentReceiver(db, storage, () => {})

  t.alike(paymentReceiver.db, db)
  t.alike(paymentReceiver.storage, storage)
  t.alike(paymentReceiver.notificationCallback.toString(), '() => {}')
})

test('PaymentReceiver.init', async t => {
  const pluginDispatch = sinon.replace(pluginManager, 'dispatchEvent', sinon.fake(pluginManager.dispatchEvent))

  const paymentReceiver = new PaymentReceiver(db, storage, () => {})

  await paymentReceiver.init(pluginManager)

  t.is(storage.create.callCount, 1)
  t.is(pluginDispatch.callCount, 1)

  t.teardown(() => {
    sinon.restore()
  })
})

test('PaymentReceiver.generateSlashpayContent', t => {
  const paymentReceiver = new PaymentReceiver(pluginManager, db, storage, () => {})

  const slashpayContent = paymentReceiver.generateSlashpayContent(['p2sh', 'p2tr'])
  t.alike(slashpayContent, {
    paymentEndpoints: {
      p2sh: 'slashpay/p2sh/slashpay.json',
      p2tr: 'slashpay/p2tr/slashpay.json'
    }
  })

  t.teardown(() => {
    sinon.restore()
  })
})

test('PaymentReceiver.getListOfSupportedPaymentMethods', t => {
  const paymentReceiver = new PaymentReceiver(pluginManager, db, storage, () => {})

  const supportedPaymentMethods = paymentReceiver.getListOfSupportedPaymentMethods(pluginManager)
  t.alike(supportedPaymentMethods, ['p2sh'])
})
