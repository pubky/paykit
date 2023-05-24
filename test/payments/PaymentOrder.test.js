const { test } = require('brittle')
const sinon = require('sinon')

const { DB } = require('../../src/DB')

const { PLUGIN_STATE, PAYMENT_STATE } = require('../../src/payments/PaymentState')
const { PaymentAmount } = require('../../src/payments/PaymentAmount')
const { Payment } = require('../../src/payments/Payment')

const { orderParams } = require('../fixtures/paymentParams')

const { PaymentOrder, ORDER_STATE, ERRORS } = require('../../src/payments/PaymentOrder')

async function getOneTimePaymentOrderInstance () {
  const db = new DB()
  await db.init()

  const params = { ...orderParams }

  return new PaymentOrder(params, db)
}

test('PaymentOrder - new (default one time)', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()

  t.alike(paymentOrder.orderParams, orderParams)
  t.is(paymentOrder.clientOrderId, orderParams.clientOrderId)
  t.alike(paymentOrder.payments, [])

  t.is(paymentOrder.frequency, 0)

  t.is(paymentOrder.state, ORDER_STATE.CREATED)

  t.alike(paymentOrder.amount, new PaymentAmount(orderParams))
  t.is(paymentOrder.counterpartyURL, orderParams.counterpartyURL)
  t.is(paymentOrder.memo, orderParams.memo || '')
})

test('PaymentOrder - new (recurring)', async t => {
  const db = new DB()
  await db.init()

  const params = { ...orderParams, frequency: 2 }

  t.exception(() => { new PaymentOrder(params, db) }, ERRORS.NOT_IMPLEMENTED) // eslint-disable-line 
})

test('PaymentOrder - new (invalid frequency)', async t => {
  const db = new DB()
  await db.init()

  const params = { ...orderParams, frequency: 'a' }

  t.exception(() => { new PaymentOrder(params, db) }, ERRORS.INVALID_FREQUENCY('a')) // eslint-disable-line 
})

test('PaymentOrder.init', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()
  t.absent(paymentOrder.id)
  await paymentOrder.init()

  t.ok(paymentOrder.id)
  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)

  const got = await paymentOrder.db.get(paymentOrder.id)
  t.alike(got, {
    id: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    state: ORDER_STATE.INITIALIZED,
    frequency: 0,
    counterpartyURL: orderParams.counterpartyURL,
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE'
  })

  t.is(paymentOrder.payments.length, 1)

  t.alike(paymentOrder.payments[0].serialize(), {
    id: 'totally-random-id',
    orderId: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    counterpartyURL: orderParams.counterpartyURL,
    direction: 'OUT',
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE',
    internalState: PAYMENT_STATE.INITIAL,
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    completedByPlugin: {},
    createdAt: paymentOrder.payments[0].createdAt,
    executeAt: paymentOrder.payments[0].executeAt
  })
})

test('PaymentOrder.serialize', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()

  const serialized = paymentOrder.serialize()
  t.alike(serialized, {
    id: null,
    clientOrderId: orderParams.clientOrderId,
    state: ORDER_STATE.CREATED,
    frequency: 0,
    counterpartyURL: orderParams.counterpartyURL,
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE'
  })
})

test('PaymentOrder.save', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()
  await paymentOrder.init()

  t.ok(paymentOrder.id)
  const gotOrder = await paymentOrder.db.get(paymentOrder.id)
  t.alike(gotOrder, {
    id: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    state: ORDER_STATE.INITIALIZED,
    frequency: 0,
    counterpartyURL: orderParams.counterpartyURL,
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE'
  })

  const gotPayment = await paymentOrder.db.get(paymentOrder.payments[0].id)
  t.alike(gotPayment, {
    id: 'totally-random-id',
    orderId: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    counterpartyURL: orderParams.counterpartyURL,
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    direction: 'OUT',
    denomination: 'BASE',
    internalState: PAYMENT_STATE.INITIAL,
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    completedByPlugin: {},
    createdAt: paymentOrder.payments[0].createdAt,
    executeAt: paymentOrder.payments[0].executeAt
  })
})

test('PaymentOrder.update', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()
  await paymentOrder.init()
  let got

  t.ok(paymentOrder.id)
  got = await paymentOrder.db.get(paymentOrder.id)
  t.is(got.amount, '100')

  paymentOrder.amount = new PaymentAmount({ amount: '101' })
  await paymentOrder.update()

  got = await paymentOrder.db.get(paymentOrder.id)

  t.alike(got, paymentOrder.serialize())
  t.is(got.amount, '101')
})

test('PaymentOrder.getFirstOutstandingPayment', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()
  const createRecurringPaymentSpy = sinon.spy(paymentOrder, 'createRecurringOrder')
  let outstandingPayment

  outstandingPayment = await paymentOrder.getFirstOutstandingPayment()
  t.is(createRecurringPaymentSpy.callCount, 0)
  t.absent(outstandingPayment)

  await paymentOrder.init()
  outstandingPayment = await paymentOrder.getFirstOutstandingPayment()
  t.alike(outstandingPayment, paymentOrder.payments[0])
})

test('PaymentOrder.getPaymentInProgress', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()
  t.absent(paymentOrder.getPaymentInProgress())

  await paymentOrder.init()
  t.absent(paymentOrder.getPaymentInProgress())

  const payment = await paymentOrder.process()
  t.alike(paymentOrder.getPaymentInProgress(), payment)
})

test('PaymentOrder.canProcess', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()

  t.not(paymentOrder.canProcess())

  await paymentOrder.init()
  t.ok(paymentOrder.canProcess())
})

test('PaymentOrder.createOneTimeOrder', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()

  await t.exception(async () => await paymentOrder.createOneTimeOrder(), ERRORS.ORDER_ID_REQUIRED)

  paymentOrder.id = '1234'
  await paymentOrder.createOneTimeOrder()

  t.is(paymentOrder.payments.length, 1)

  const payment = paymentOrder.payments[0].serialize()
  t.alike(payment, {
    id: null,
    orderId: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    counterpartyURL: orderParams.counterpartyURL,
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    direction: 'OUT',
    denomination: 'BASE',
    internalState: PAYMENT_STATE.INITIAL,
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    completedByPlugin: {},
    createdAt: paymentOrder.payments[0].createdAt,
    executeAt: paymentOrder.payments[0].executeAt
  })
})

test('PaymentOrder.processPayment', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()

  paymentOrder.id = '1234'
  await paymentOrder.init()

  t.is(paymentOrder.payments.length, 1)

  const payment = paymentOrder.payments[0].serialize()
  t.alike(payment, {
    id: payment.id,
    orderId: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    counterpartyURL: orderParams.counterpartyURL,
    memo: '',
    direction: 'OUT',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE',
    internalState: PAYMENT_STATE.INITIAL,
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    completedByPlugin: {},
    createdAt: paymentOrder.payments[0].createdAt,
    executeAt: paymentOrder.payments[0].executeAt
  })

  payment.executeAt = payment.executeAt + 100000
  let res

  res = await paymentOrder.processPayment(new Payment(payment, paymentOrder.db))
  t.alike(res.serialize(), payment)

  payment.executeAt = payment.executeAt - 1000000
  res = await paymentOrder.processPayment(new Payment(payment, paymentOrder.db))
  const serialized = res.serialize()

  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.is(serialized.currentPlugin.name, 'p2sh')
})

test('PaymentOrder.complete', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()
  await paymentOrder.init()

  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)

  t.ok(paymentOrder.id)

  paymentOrder.state = ORDER_STATE.CANCELLED
  await paymentOrder.update()
  await t.exception(async () => { await paymentOrder.complete() }, ERRORS.ORDER_CANCELLED)
  t.is(paymentOrder.state, ORDER_STATE.CANCELLED)

  paymentOrder.state = ORDER_STATE.INITIALIZED
  await paymentOrder.update()

  await t.exception(async () => { await paymentOrder.complete() }, ERRORS.OUTSTANDING_PAYMENTS)
  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)

  await paymentOrder.process()
  await t.exception(async () => { await paymentOrder.complete() }, ERRORS.OUTSTANDING_PAYMENTS)
  t.is(paymentOrder.state, ORDER_STATE.PROCESSING)

  await paymentOrder.payments[0].internalState.complete()
  await paymentOrder.complete()

  t.is(paymentOrder.state, ORDER_STATE.COMPLETED)

  await t.exception(async () => { await paymentOrder.complete() }, ERRORS.ORDER_COMPLETED)
  t.is(paymentOrder.state, ORDER_STATE.COMPLETED)
})

test('PaymentOrder.process', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()
  await paymentOrder.init()
  let payment
  let serialized

  t.ok(paymentOrder.id)
  payment = await paymentOrder.process()
  serialized = payment.serialize()
  t.alike(serialized, paymentOrder.payments[0].serialize())

  t.is(serialized.id, payment.id)
  t.is(serialized.orderId, paymentOrder.id)
  t.is(serialized.clientOrderId, orderParams.clientOrderId)
  t.is(serialized.counterpartyURL, orderParams.counterpartyURL)
  t.is(serialized.memo, '')
  t.alike(serialized.sendingPriority, orderParams.sendingPriority)
  t.is(serialized.amount, orderParams.amount)
  t.is(serialized.currency, 'BTC')
  t.is(serialized.denomination, 'BASE')
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.is(serialized.currentPlugin.name, 'p2sh')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.absent(serialized.currentPlugin.endAt)

  // same order
  const paymentInProgress = await paymentOrder.process()
  t.alike(paymentInProgress.serialize(), serialized)

  await paymentOrder.payments[0].internalState.failCurrentPlugin()

  payment = await paymentOrder.process()
  serialized = payment.serialize()
  t.alike(serialized, paymentOrder.payments[0].serialize())

  t.is(serialized.id, payment.id)
  t.is(serialized.orderId, paymentOrder.id)
  t.is(serialized.clientOrderId, orderParams.clientOrderId)
  t.is(serialized.counterpartyURL, orderParams.counterpartyURL)
  t.is(serialized.memo, '')
  t.alike(serialized.sendingPriority, orderParams.sendingPriority)
  t.is(serialized.amount, orderParams.amount)
  t.is(serialized.currency, 'BTC')
  t.is(serialized.denomination, 'BASE')
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)

  t.alike(serialized.pendingPlugins, [])
  t.is(serialized.triedPlugins.length, 1)
  t.is(serialized.triedPlugins[0].name, 'p2sh')
  t.ok(serialized.triedPlugins[0].startAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt <= Date.now())

  t.is(serialized.currentPlugin.name, 'p2tr')
  t.ok(serialized.currentPlugin.startAt <= Date.now())

  await payment.complete()
  payment = await paymentOrder.process()

  t.is(paymentOrder.state, ORDER_STATE.COMPLETED)

  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.COMPLETED)
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.pendingPlugins, [])
  t.is(serialized.triedPlugins.length, 2)
  t.is(serialized.triedPlugins[0].name, 'p2sh')
  t.is(serialized.triedPlugins[0].state, PLUGIN_STATE.FAILED)
  t.is(serialized.triedPlugins[1].name, 'p2tr')
  t.is(serialized.triedPlugins[1].state, PLUGIN_STATE.SUCCESS)
  t.is(serialized.completedByPlugin.name, 'p2tr')
  t.is(serialized.completedByPlugin.state, PLUGIN_STATE.SUCCESS)
  t.ok(serialized.completedByPlugin.startAt <= Date.now())
  t.ok(serialized.completedByPlugin.endAt <= Date.now())
})

test('PaymentOrder.cancel', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()
  await paymentOrder.init()

  t.ok(paymentOrder.id)

  await paymentOrder.cancel()

  t.is(paymentOrder.state, ORDER_STATE.CANCELLED)
  t.is(paymentOrder.payments[0].serialize().internalState, PAYMENT_STATE.CANCELLED)
})

test('PaymentOrder.find', async t => {
  const paymentOrder = await getOneTimePaymentOrderInstance()
  await paymentOrder.init()
  const id = paymentOrder.id

  const got = await PaymentOrder.find(id, paymentOrder.db)
  t.alike(got.serialize(), paymentOrder.serialize())
})

// test('PaymentOrder.createRecurringOrder', async t => {
//   const paymentOrder = await getOneTimePaymentOrderInstance()
// 
//   await t.exception(async () => await paymentOrder.createRecurringOrder(), ERRORS.NOT_IMPLEMENTED)
// })
