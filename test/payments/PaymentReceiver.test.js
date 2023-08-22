const { Relay } = require('@synonymdev/web-relay')
const sinon = require('sinon')
const { test } = require('brittle')

const { DB } = require('../../src/DB')
const { PLUGIN_STATE, PAYMENT_STATE } = require('../../src/payments/PaymentObject')

const { SlashtagsConnector, SLASHPAY_PATH } = require('../../src/slashtags')

const { PluginManager } = require('../../src/plugins/PluginManager')

const { pluginConfig } = require('../fixtures/config.js')

const { PaymentReceiver } = require('../../src/payments/PaymentReceiver')

const { dropTables, tmpdir } = require('../helpers')

async function createStorageEntities (t) {
  const db = new DB({ name: 'test', path: './test_db' })
  await db.init()

  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const receiver = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  return { db, receiver, relay }
}

test('PaymentReceiver', async t => {
  const { db, receiver, relay } = await createStorageEntities(t)

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin('p2sh')

  const notificationCallback = () => {}

  const paymentReceiver = new PaymentReceiver(db, pluginManager, receiver, notificationCallback)

  t.alike(paymentReceiver.db, db)
  t.alike(paymentReceiver.storage, receiver)
  t.alike(paymentReceiver.notificationCallback.toString(), notificationCallback.toString())

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentReceiver.init', async t => {
  const { db, receiver, relay } = await createStorageEntities(t)

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
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentReceiver.handleNewPayment', async t => {
  const { db, receiver, relay } = await createStorageEntities(t)

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin('p2sh')

  const notificationCallback = sinon.fake.resolves()
  const pluginDispatch = sinon.replace(pluginManager, 'dispatchEvent', sinon.fake(pluginManager.dispatchEvent))
  const paymentReceiver = new PaymentReceiver(db, pluginManager, receiver, notificationCallback)

  const prePayments = await db.getPayments()
  t.is(prePayments.length, 0)
  await paymentReceiver.handleNewPayment({
    amount: '1000',
    pluginName: 'p2sh',
    clientOrderId: 'network-id'
  })

  const postPayments = await db.getPayments()
  t.is(postPayments.length, 1)
  const paymentId = postPayments[0].id

  const payment = await db.getPayment(paymentId)
  t.is(payment.id, paymentId)
  t.ok(payment.orderId)
  t.is(payment.clientOrderId, 'network-id')
  t.is(payment.internalState, PAYMENT_STATE.COMPLETED)
  t.is(payment.counterpartyURL, await receiver.getUrl())
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
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentReceiver.generateSlashpayContent - no amount', async t => {
  const { db, receiver, relay } = await createStorageEntities(t)

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
    await dropTables(db)
    relay.close()
  })
})

test('PaymentReceiver.generateSlashpayContent - with amount', async t => {
  const { db, receiver, relay } = await createStorageEntities(t)

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
    await dropTables(db)
    relay.close()
  })
})

test('PaymentReceiver.getListOfSupportedPaymentMethods', async t => {
  const { db, receiver, relay } = await createStorageEntities(t)

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin('p2sh')

  const paymentReceiver = new PaymentReceiver(db, pluginManager, receiver, () => {})

  const supportedPaymentMethods = paymentReceiver.getListOfSupportedPaymentMethods()
  t.alike(supportedPaymentMethods, ['p2sh'])

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})
