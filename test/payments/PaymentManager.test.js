const sinon = require('sinon')

const { test } = require('brittle')

const { DB } = require('../../src/DB')

const { config } = require('../fixtures/config')
const { paymentParams } = require('../fixtures/paymentParams')

const { PaymentManager } = require('../../src/payments/PaymentManager')
const { PaymentReceiver } = require('../../src/payments/PaymentReceiver')

test('PaymentManager.constructor', async t => {
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)

  t.alike(paymentManager.db, db)
  t.alike(paymentManager.config, config)
  t.is(paymentManager.ready, false)
})

test('PaymentManager.init', async t => {
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  const init = sinon.stub(db, 'init').resolves()

  await paymentManager.init()

  t.is(paymentManager.ready, true)
  t.is(init.calledOnce, true)

  t.teardown(() => sinon.restore())
})

test('PaymentManager.createPaymentOrder', async t => {
  const db = new DB()

  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const paymentOrder = await paymentManager.createPaymentOrder(paymentParams)

  const got = await db.get(paymentOrder.id)
  t.alike(got, paymentOrder)
})

test('PaymentManager.sendPayment', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')

  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const paymentOrder = await paymentManager.createPaymentOrder(paymentParams)

  await paymentManager.sendPayment(paymentOrder.id)

  t.ok(p2shStub.init.calledOnce)
  t.ok(p2shStub.init.getCall(0).returnValue.pay.calledOnce)
})

test('PaymentManager.receivePayments', async t => {
  const validConfig = { ...config }
  validConfig.plugins = {
    p2sh: config.plugins.p2sh,
    p2tr: config.plugins.p2tr
  }

  const db = new DB()
  const paymentManager = new PaymentManager(validConfig, db)
  await paymentManager.init()
  const url = await paymentManager.receivePayments()

  // FIXME: hardcoded in SlashtagsAccessObject for now
  t.is(url, 'randomDriveKey')
})

test('PaymentManager.handleNewPayment', async t => {
  const db = new DB()

  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const stub = sinon.replace(paymentManager, 'userNotificationEndpoint', sinon.fake())
  const receiverHandler = sinon.replace(
    PaymentReceiver.prototype,
    'handleNewPayment',
    sinon.fake(PaymentReceiver.prototype.handleNewPayment)
  )

  await paymentManager.handleNewPayment({
    ...paymentParams,
    id: 'test.handleNewPayment',
    pluginName: 'p2sh'
  })

  t.is(stub.calledOnce, true)
  t.is(receiverHandler.calledOnce, true)

  const got = await db.get('test.handleNewPayment')
  t.is(got.id, 'test.handleNewPayment')
  t.is(got.clientOrderId, paymentParams.clientOrderId)
  t.is(got.amount, paymentParams.amount)
  t.is(got.targetURL, paymentParams.targetURL)

  t.teardown(() => sinon.restore())
})

test('PaymentManager.handlePaymentUpdate', async t => {
  const db = new DB()

  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const paymentOrder = await paymentManager.createPaymentOrder(paymentParams)
  await paymentManager.sendPayment(paymentOrder.id)

  const stub = sinon.spy(paymentManager, 'userNotificationEndpoint')

  await paymentManager.handlePaymentUpdate({
    orderId: paymentOrder.id,
    pluginName: 'p2sh',
    payload: { foo: 'bar' }
  })

  t.is(stub.callCount, 2)

  t.teardown(() => sinon.restore())
})

test('PaymentManager.entryPointForUser', async t => {
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const paymentOrder = await paymentManager.createPaymentOrder(paymentParams)
  await paymentManager.sendPayment(paymentOrder.id)

  const data = { orderId: paymentOrder.id, pluginName: 'p2sh', foo: 'bar' }
  await paymentManager.entryPointForUser(data)

  t.teardown(() => sinon.restore())
})

test('PaymentManager.entryPointForPlugin waiting for client', async t => {
  const db = new DB()

  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const handleNewPaymentStub = sinon.stub(paymentManager, 'handleNewPayment').resolves()
  const handlePaymentUpdateStub = sinon.stub(paymentManager, 'handlePaymentUpdate').resolves()

  await paymentManager.entryPointForPlugin({ type: 'payment_new' })

  t.is(handleNewPaymentStub.calledOnce, true)
  t.is(handlePaymentUpdateStub.calledOnce, false)

  handleNewPaymentStub.resetHistory()

  await paymentManager.entryPointForPlugin({ type: 'payment_update' })

  t.is(handleNewPaymentStub.calledOnce, false)
  t.is(handlePaymentUpdateStub.calledOnce, true)

  t.teardown(() => sinon.restore())
})
