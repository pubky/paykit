const sinon = require('sinon')
const { test } = require('brittle')

const { DB } = require('../../src/DB')
const db = new DB()
;(async () => { await db.init() })()

const { SlashtagsAccessObject } = require('../../src/SlashtagsAccessObject')

const { PluginManager } = require('../../src/plugins/PluginManager')

const { pluginConfig } = require('../fixtures/config.js')

const { PaymentReceiver } = require('../../src/payments/PaymentReceiver')

test('PaymentReceiver', async t => {
  const storage = new SlashtagsAccessObject('key', './dir')
  await storage.init()

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  const paymentReceiver = new PaymentReceiver(db, pluginManager, storage, () => {})

  t.alike(paymentReceiver.db, db)
  t.alike(paymentReceiver.storage, storage)
  t.alike(paymentReceiver.notificationCallback.toString(), '() => {}')
})

test('PaymentReceiver.init', async t => {
  const storage = new SlashtagsAccessObject('key', './dir')
  await storage.init()
  const storageCreate = sinon.replace(storage, 'create', sinon.fake(storage.create))

  const pluginManager = new PluginManager()
  await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  const pluginDispatch = sinon.replace(pluginManager, 'dispatchEvent', sinon.fake(pluginManager.dispatchEvent))

  const paymentReceiver = new PaymentReceiver(db, pluginManager, storage, () => {})

  const res = await paymentReceiver.init()

  t.ok(res)
  t.is(storageCreate.callCount, 1)
  t.is(pluginDispatch.callCount, 1)
})

test('PaymentReceiver.receivePaymentCallback', async t => {
  const storage = new SlashtagsAccessObject('key', './dir')
  await storage.init()

  const pluginManager = new PluginManager()
  await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  const paymentReceiver = new PaymentReceiver(db, pluginManager, storage, () => {})

  await paymentReceiver.receivePaymentCallback({
    pluginState: 'newPayment',
    pluginName: 'p2sh',

    orderId: 'testOrderId',
    clientOrderId: 'testClientOrderId',
    amount: '1000',
    targetURL: 'sourgURL'
  })

  const payment = await db.get('totally-random-id')
  t.alike(payment, {
    id: 'totally-random-id',
    orderId: 'testOrderId',
    clientOrderId: 'testClientOrderId',
    internalState: 'initial',
    targetURL: 'sourgURL',
    memo: '',
    amount: '1000',
    currency: 'BTC',
    denomination: 'BASE',
    sendingPriority: ['p2sh'],
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    sentByPlugin: {},
    createdAt: payment.createdAt,
    executeAt: payment.executeAt
  })
})

test('PaymentReceiver.generateSlashpayContent', async t => {
  const storage = new SlashtagsAccessObject('key', './dir')
  await storage.init()

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  const paymentReceiver = new PaymentReceiver(pluginManager, db, storage, () => {})

  const slashpayContent = paymentReceiver.generateSlashpayContent(['p2sh', 'p2tr'])
  t.alike(slashpayContent, {
    paymentEndpoints: {
      p2sh: 'slashpay/p2sh/slashpay.json',
      p2tr: 'slashpay/p2tr/slashpay.json'
    }
  })
})

test('PaymentReceiver.getListOfSupportedPaymentMethods', async t => {
  const storage = new SlashtagsAccessObject('key', './dir')
  await storage.init()

  const pluginManager = new PluginManager(pluginConfig)
  await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  const paymentReceiver = new PaymentReceiver(db, pluginManager, storage, () => {})

  const supportedPaymentMethods = paymentReceiver.getListOfSupportedPaymentMethods()
  t.alike(supportedPaymentMethods, ['p2sh'])
})
