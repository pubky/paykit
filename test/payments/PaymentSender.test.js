const sinon = require('sinon')
const { test } = require('brittle')

const { DB } = require('../../src/DB')

const { PluginManager } = require('../../src/plugins/PluginManager')
const { pluginConfig } = require('../fixtures/config.js')

const { orderParams } = require('../fixtures/paymentParams')

const { PAYMENT_STATE } = require('../../src/payments/Payment')
const { PaymentSender } = require('../../src/payments/PaymentSender')
const { PaymentOrder } = require('../../src/payments/PaymentOrder')

async function getPaymentOrderInstance () {
  const db = new DB()
  await db.init()

  const params = { ...orderParams }

  return new PaymentOrder(params, db)
}

test('PaymentSender - constructor', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const paymentOrder = await getPaymentOrderInstance()
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)
  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})

  t.alike(paymentSender.paymentOrder, paymentOrder)
  t.alike(paymentSender.notificationCallback.toString(), '() => {}')

  t.teardown(() => {
    sinon.restore()
    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender - submit', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const paymentOrder = await getPaymentOrderInstance()
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  t.is(Object.keys(pluginManager.plugins).length, 1)
  t.is(pluginManager.plugins.p2sh.plugin.pay.callCount, 1)
  t.alike(pluginManager.plugins.p2sh.plugin.pay.getCall(0).args, [paymentOrder.payments[0].serialize(), paymentSender.stateUpdateCallback])

  t.teardown(() => {
    sinon.restore()
    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender - stateUpdateCallback (success)', async t => {
  const paymentOrder = await getPaymentOrderInstance()
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const payment = paymentOrder.payments[0]
  const paymentUpdate = {
    id: payment.id,
    pluginState: 'success'
  }
  await paymentSender.stateUpdateCallback(paymentUpdate)

  const got = await paymentOrder.db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.COMPLETED)
})

test('PaymentSender - stateUpdateCallback (failure, success)', async t => {
  const paymentOrder = await getPaymentOrderInstance()
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const payment = paymentOrder.payments[0]
  let paymentUpdate = {
    id: payment.id,
    pluginState: 'failed'
  }

  await paymentSender.stateUpdateCallback(paymentUpdate)

  let got = await paymentOrder.db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.IN_PROGRESS)

  paymentUpdate = {
    id: payment.id,
    pluginState: 'success'
  }

  await paymentSender.stateUpdateCallback(paymentUpdate)
  got = await paymentOrder.db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.COMPLETED)
})
