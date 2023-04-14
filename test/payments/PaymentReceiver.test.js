const sinon = require('sinon')
const { test } = require('brittle')

const { DB } = require('../fixtures/db')
const db = new DB()

const storage = require('../fixtures/storageInstance')

const { PluginManager } = require('../../src/pluginManager')

const { pluginConfig } = require('../fixtures/config.js')
const pluginAStub = require('../fixtures/pluginA/main.js')

const pluginManager = new PluginManager()
// TODO: add plugins to pluginManager

const { PaymentReceiver } = require('../../src/payments/PaymentReceiver')

test('PaymentReceiver', t => {
  const paymentReceiver = new PaymentReceiver(pluginManager, db, storage, () => {})

  t.alike(paymentReceiver.pluginManager, pluginManager)
  t.alike(paymentReceiver.db, db)
  t.alike(paymentReceiver.storage, storage)
  t.alike(paymentReceiver.notificationCallback.toString(), '() => {}')
})

test('PaymentReceiver.init', async t => {
  await pluginManager.loadPlugin(pluginConfig.plugins[0], storage)
  const pluginDispatch = sinon.replace(pluginManager, 'dispatchEvent', sinon.fake(pluginManager.dispatchEvent))

  const paymentReceiver = new PaymentReceiver(pluginManager, db, storage, () => {})

  await paymentReceiver.init()

  t.is(storage.create.callCount, 1)
  t.is(pluginDispatch.callCount, 1)

  t.teardown(() => {
    sinon.restore()
  })
})
