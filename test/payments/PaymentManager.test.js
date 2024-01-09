const sinon = require('sinon')

const { test } = require('brittle')

const { config } = require('../fixtures/config')
const { paymentParams } = require('../fixtures/paymentParams')

const { PAYMENT_STATE, PLUGIN_STATE } = require('../../src/payments/PaymentObject')
const { PaymentManager } = require('../../src/payments/PaymentManager')
const { PaymentReceiver } = require('../../src/payments/PaymentReceiver')

const { getOneTimePaymentOrderEntities, dropTables } = require('../helpers')

test('PaymentManager.constructor', async t => {
  const { sender, db, relay } = await getOneTimePaymentOrderEntities(t, false, false)

  const paymentManager = new PaymentManager({ config, db, slashtagsConnector: sender, notificationCallback: console.log })

  t.alike(paymentManager.db, db)
  t.alike(paymentManager.config, config)
  t.alike(paymentManager.slashtagsConnector, sender)
  t.is(paymentManager.ready, false)

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentManager.init', async t => {
  const { sender, db, relay } = await getOneTimePaymentOrderEntities(t)
  const paymentManager = new PaymentManager({ config, db, slashtagsConnector: sender, notificationCallback: console.log })

  const dbInit = sinon.stub(db, 'init').resolves()

  await paymentManager.init()

  t.is(paymentManager.ready, true)
  t.is(dbInit.calledOnce, true)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentManager.createPaymentOrder', async t => {
  const { sender, db, relay } = await getOneTimePaymentOrderEntities(t, true, false)

  const paymentManager = new PaymentManager({ config, db, slashtagsConnector: sender, notificationCallback: console.log })
  await paymentManager.init()

  const paymentOrder = await paymentManager.createPaymentOrder({
    ...paymentParams,
    counterpartyURL: await sender.getUrl()
  })

  const got = await db.getOrder(paymentOrder.id)
  t.alike(got, paymentOrder)

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentManager.sendPayment', async t => {
  const { paymentOrder, sender, db, relay } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const p2shStub = require('../fixtures/p2sh/main.js')

  const paymentManager = new PaymentManager({ config, db, slashtagsConnector: sender, notificationCallback: console.log })
  await paymentManager.init()

  await paymentManager.sendPayment(paymentOrder.id)

  t.ok(p2shStub.init.calledOnce)
  t.ok(p2shStub.init.getCall(0).returnValue.pay.calledOnce)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentManager.receivePayments', async t => {
  const { receiver, db, relay } = await getOneTimePaymentOrderEntities(t, false, false)

  const validConfig = { ...config }
  validConfig.plugins = {
    p2sh: config.plugins.p2sh,
    p2tr: config.plugins.p2tr
  }

  const paymentManager = new PaymentManager({ config: validConfig, db, slashtagsConnector: receiver, notificationCallback: console.log })
  await paymentManager.init()
  const url = await paymentManager.receivePayments()

  t.ok(url.includes(await receiver.getUrl()))

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentManager.handleNewPayment', async t => {
  const { receiver, db, relay } = await getOneTimePaymentOrderEntities(t, true, false)

  const paymentManager = new PaymentManager({ config, db, slashtagsConnector: receiver, notificationCallback: console.log })
  await paymentManager.init()

  const stub = sinon.replace(paymentManager, 'userNotificationEndpoint', sinon.fake())
  const receiverHandler = sinon.replace(
    PaymentReceiver.prototype,
    'handleNewPayment',
    sinon.fake(PaymentReceiver.prototype.handleNewPayment)
  )

  const prePayments = await db.getIncomingPayments()
  t.is(prePayments.length, 0)
  await paymentManager.handleNewPayment({
    amount: '1000',
    pluginName: 'p2sh',
    clientOrderId: 'network-id',
    isPersonalPayment: false,
    state: 'success',
  })

  t.is(stub.calledOnce, true)
  t.is(receiverHandler.calledOnce, true)

  const postPayments = await db.getIncomingPayments()
  t.is(postPayments.length, 1)
  const paymentId = postPayments[0].id

  const got = await db.getIncomingPayment(paymentId)
  t.is(got.id, paymentId)
  t.is(got.clientOrderId, 'network-id')
  t.is(got.memo, '')
  t.is(got.amount, '1000')
  t.is(got.currency, 'BTC')
  t.is(got.denomination, 'BASE')
  t.is(got.receivedByPlugins.length, 1)
  t.is(got.receivedByPlugins[0].name, 'p2sh')
  t.is(got.receivedByPlugins[0].state, PLUGIN_STATE.SUCCESS)
  t.ok(got.receivedByPlugins[0].receivedAt)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentManager.handlePaymentUpdate', async t => {
  const { receiver, db, relay } = await getOneTimePaymentOrderEntities(t, true, false)

  const paymentManager = new PaymentManager({ config, db, slashtagsConnector: receiver, notificationCallback: console.log })
  await paymentManager.init()

  const stub = sinon.replace(paymentManager, 'userNotificationEndpoint', sinon.fake())

  const paymentOrder = await paymentManager.createPaymentOrder({
    ...paymentParams,
    counterpartyURL: await receiver.getUrl()
  })
  await paymentManager.sendPayment(paymentOrder.id)

  await paymentManager.handlePaymentUpdate({
    orderId: paymentOrder.id,
    pluginName: 'p2sh',
    payload: { foo: 'bar' }
  })

  t.is(stub.callCount, 2)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentManager.entryPointForUser', async t => {
  const { receiver, db, relay } = await getOneTimePaymentOrderEntities(t, true, false)

  const paymentManager = new PaymentManager({ config, db, slashtagsConnector: receiver, notificationCallback: console.log })
  await paymentManager.init()

  const paymentOrder = await paymentManager.createPaymentOrder({
    ...paymentParams,
    counterpartyURL: await receiver.getUrl()
  })
  await paymentManager.sendPayment(paymentOrder.id)

  const data = { orderId: paymentOrder.id, pluginName: 'p2sh', foo: 'bar' }
  await paymentManager.entryPointForUser(data)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentManager.entryPointForPlugin waiting for client', async t => {
  const { receiver, db, relay } = await getOneTimePaymentOrderEntities(t, true, false)

  const paymentManager = new PaymentManager({ config, db, slashtagsConnector: receiver, notificationCallback: console.log })
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

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})
