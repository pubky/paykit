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

  const paymentManager = new PaymentManager(config, db, sender)

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
  const paymentManager = new PaymentManager(config, db, sender)

  const dbInit = sinon.stub(db, 'init').resolves()
  const stInit = sinon.stub(sender, 'init').resolves()

  await paymentManager.init()

  t.is(paymentManager.ready, true)
  t.is(dbInit.calledOnce, true)
  t.is(stInit.calledOnce, true)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentManager.createPaymentOrder', async t => {
  const { sender, db, relay } = await getOneTimePaymentOrderEntities(t, true, false)

  const paymentManager = new PaymentManager(config, db, sender)
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

  const paymentManager = new PaymentManager(config, db, sender)
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

  const paymentManager = new PaymentManager(validConfig, db, receiver)
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

  const paymentManager = new PaymentManager(config, db, receiver, console.log)
  await paymentManager.init()

  const stub = sinon.replace(paymentManager, 'userNotificationEndpoint', sinon.fake())
  const receiverHandler = sinon.replace(
    PaymentReceiver.prototype,
    'handleNewPayment',
    sinon.fake(PaymentReceiver.prototype.handleNewPayment)
  )

  const prePayments = await db.getPayments()
  t.is(prePayments.length, 0)
  await paymentManager.handleNewPayment({
    amount: '1000',
    pluginName: 'p2sh',
    clientOrderId: 'network-id',
    amountWasSpecified: false
  })

  t.is(stub.calledOnce, true)
  t.is(receiverHandler.calledOnce, true)

  const postPayments = await db.getPayments()
  t.is(postPayments.length, 1)
  const paymentId = postPayments[0].id

  const got = await db.getPayment(paymentId)
  t.is(got.id, paymentId)
  t.ok(got.orderId)
  t.is(got.clientOrderId, 'network-id')
  t.is(got.internalState, PAYMENT_STATE.COMPLETED)
  t.is(got.counterpartyURL, await receiver.getUrl())
  t.is(got.memo, '')
  t.is(got.amount, '1000')
  t.is(got.currency, 'BTC')
  t.is(got.denomination, 'BASE')
  t.alike(got.sendingPriority, ['p2sh'])
  t.alike(got.pendingPlugins, [])
  t.alike(got.triedPlugins, [])
  t.alike(got.currentPlugin, {})
  t.is(got.completedByPlugin.name, 'p2sh')
  t.is(got.completedByPlugin.state, PLUGIN_STATE.SUCCESS)
  t.ok(got.completedByPlugin.startAt)
  t.ok(got.completedByPlugin.endAt)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentManager.handlePaymentUpdate', async t => {
  const { receiver, db, relay } = await getOneTimePaymentOrderEntities(t, true, false)

  const paymentManager = new PaymentManager(config, db, receiver, console.log)
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

  const paymentManager = new PaymentManager(config, db, receiver)
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

  const paymentManager = new PaymentManager(config, db, receiver)
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
