const sinon = require('sinon')
const { test } = require('brittle')

const { DB } = require('../../src/DB')
const { PLUGIN_STATE, PAYMENT_STATE } = require('../../src/payments/PaymentObject')

const { SlashtagsConnector, SLASHPAY_PATH } = require('../../src/slashtags')
const createTestnet = require('@hyperswarm/testnet')

const { PluginManager } = require('../../src/plugins/PluginManager')

const { pluginConfig } = require('../fixtures/config.js')

const { PaymentReceiver } = require('../../src/payments/PaymentReceiver')

async function createStorageEntities (t) {
  const testnet = await createTestnet(3, t)

  const db = new DB()
  await db.init()

  const receiver = new SlashtagsConnector(testnet)
  await receiver.init()

  return { db, receiver }
}

test('PaymentReceiver', async t => {
  const { db, receiver } = await createStorageEntities(t)

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin('p2sh')

  const notificationCallback = () => {}

  const paymentReceiver = new PaymentReceiver(db, pluginManager, receiver, notificationCallback)

  t.alike(paymentReceiver.db, db)
  t.alike(paymentReceiver.storage, receiver)
  t.alike(paymentReceiver.notificationCallback.toString(), notificationCallback.toString())

  t.teardown(async () => {
    await receiver.close()
  })
})

test('PaymentReceiver.init', async t => {
  const { db, receiver } = await createStorageEntities(t)

  const receiverCreate = sinon.replace(receiver, 'create', sinon.fake(receiver.create))
  const generateSlashpayContent = sinon.replace(
    PaymentReceiver.prototype,
    'generateSlashpayContent',
    sinon.fake(PaymentReceiver.prototype.generateSlashpayContent)
  )

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin('p2sh')

  const pluginDispatch = sinon.replace(pluginManager, 'dispatchEvent', sinon.fake(pluginManager.dispatchEvent))

  const notificationCallback = () => {}

  const paymentReceiver = new PaymentReceiver(db, pluginManager, receiver, notificationCallback)
  const res = await paymentReceiver.init()

  t.ok(res, `${receiver.url}${SLASHPAY_PATH}`)
  t.is(receiverCreate.callCount, 1)
  t.is(pluginDispatch.callCount, 1)
  t.is(generateSlashpayContent.callCount, 1)

  t.teardown(async () => {
    await receiver.close()
    sinon.restore()
  })
})

test('PaymentReceiver.handleNewPayment', async t => {
  const { db, receiver } = await createStorageEntities(t)

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin('p2sh')

  const notificationCallback = sinon.fake.resolves()
  const pluginDispatch = sinon.replace(pluginManager, 'dispatchEvent', sinon.fake(pluginManager.dispatchEvent))
  const paymentReceiver = new PaymentReceiver(db, pluginManager, receiver, notificationCallback)

  await paymentReceiver.handleNewPayment({
    amount: '1000',
    pluginName: 'p2sh',
    clientOrderId: 'network-id'
  })

  // HACK
  const paymentId = Object.keys(db.db)[0]
  const payment = await db.get(paymentId)
  t.is(payment.id, paymentId)
  t.ok(payment.orderId)
  t.is(payment.clientOrderId, 'network-id')
  t.is(payment.internalState, PAYMENT_STATE.COMPLETED)
  t.is(payment.counterpartyURL, receiver.getUrl())
  t.is(payment.memo, '')
  t.is(payment.amount, '1000')
  t.is(payment.currency, 'BTC')
  t.is(payment.denomination, 'BASE')
  t.alike(payment.sendingPriority, ['p2sh'])
  t.alike(payment.pendingPlugins, [])
  t.alike(payment.triedPlugins, [])
  t.alike(payment.currentPlugin, {})
  t.is(payment.completedByPlugin.name, 'p2sh')
  t.is(payment.completedByPlugin.state, PLUGIN_STATE.SUCCESS)
  t.ok(payment.completedByPlugin.startAt)
  t.ok(payment.completedByPlugin.endAt)

  t.is(notificationCallback.callCount, 1)
  const arg = notificationCallback.getCall(0).args[0]
  t.alike(arg.serialize(), payment)

  t.is(pluginDispatch.callCount, 1)

  t.teardown(async () => {
    await receiver.close()
    sinon.restore()
  })
})

test('PaymentReceiver.generateSlashpayContent - no amount', async t => {
  const { db, receiver } = await createStorageEntities(t)

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin('p2sh')
  await pluginManager.loadPlugin('p2tr')

  const paymentReceiver = new PaymentReceiver(db, pluginManager, receiver, () => {})

  const { slashpayFile } = paymentReceiver.generateSlashpayContent(['p2sh', 'p2tr'])
  t.alike(slashpayFile, {
    paymentEndpoints: {
      p2sh: '/public/slashpay/p2sh/slashpay.json',
      p2tr: '/public/slashpay/p2tr/slashpay.json'
    }
  })

  t.teardown(async () => {
    await receiver.close()
  })
})

test('PaymentReceiver.generateSlashpayContent - with amount', async t => {
  const { db, receiver } = await createStorageEntities(t)

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin('p2sh')
  await pluginManager.loadPlugin('p2tr')

  const paymentReceiver = new PaymentReceiver(db, pluginManager, receiver, () => {})

  const { id, slashpayFile } = paymentReceiver.generateSlashpayContent(['p2sh', 'p2tr'], 100)
  t.alike(slashpayFile, {
    paymentEndpoints: {
      p2sh: `/${id}/slashpay/p2sh/slashpay.json`,
      p2tr: `/${id}/slashpay/p2tr/slashpay.json`
    }
  })

  t.teardown(async () => {
    await receiver.close()
  })
})

test('PaymentReceiver.getListOfSupportedPaymentMethods', async t => {
  const { db, receiver } = await createStorageEntities(t)

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin('p2sh')

  const paymentReceiver = new PaymentReceiver(db, pluginManager, receiver, () => {})

  const supportedPaymentMethods = paymentReceiver.getListOfSupportedPaymentMethods()
  t.alike(supportedPaymentMethods, ['p2sh'])

  t.teardown(async () => {
    await receiver.close()
  })
})
