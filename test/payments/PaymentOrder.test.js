const { test } = require('brittle')
const sinon = require('sinon')
const { Relay } = require('@synonymdev/web-relay')

const { DB } = require('../../src/DB')

const { PLUGIN_STATE, PAYMENT_STATE } = require('../../src/payments/PaymentState')
const { PaymentAmount } = require('../../src/payments/PaymentAmount')
const { PaymentObject } = require('../../src/payments/PaymentObject')

const { orderParams } = require('../fixtures/paymentParams')

const { PaymentOrder, ORDER_STATE, ERRORS } = require('../../src/payments/PaymentOrder')
const { SlashtagsConnector, SLASHPAY_PATH } = require('../../src/slashtags')

const { getOneTimePaymentOrderEntities, dropTables, tmpdir } = require('../helpers')

test('PaymentOrder - new (default one time)', async t => {
  const { paymentOrder, receiver, db, relay } = await getOneTimePaymentOrderEntities(t)

  t.alike(paymentOrder.orderParams, {
    ...orderParams,
    counterpartyURL: await receiver.getUrl()
  })
  t.is(paymentOrder.clientOrderId, orderParams.clientOrderId)
  t.alike(paymentOrder.payments, [])

  t.is(paymentOrder.frequency, 0)

  t.is(paymentOrder.state, ORDER_STATE.CREATED)

  t.alike(paymentOrder.amount, new PaymentAmount(orderParams))
  t.is(paymentOrder.counterpartyURL, await receiver.getUrl())
  t.is(paymentOrder.memo, orderParams.memo || '')

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder - new (invalid frequency)', async t => {
  const db = new DB({ name: 'test', path: './test_db' })
  await db.init()

  const params = { ...orderParams, frequency: 'a' }

  t.exception(() => { new PaymentOrder(params, db) }, ERRORS.INVALID_FREQUENCY('a')) // eslint-disable-line 

  await t.teardown(async () => {
    await dropTables(db)
  })
})

test('PaymentOrder.init', async t => {
  const { paymentOrder, receiver, db, relay } = await getOneTimePaymentOrderEntities(t)
  t.absent(paymentOrder.id)
  await paymentOrder.init()

  t.ok(paymentOrder.id)
  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)

  const got = await paymentOrder.db.getOrder(paymentOrder.id)
  t.alike(got, {
    id: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    state: ORDER_STATE.INITIALIZED,
    frequency: 0,
    counterpartyURL: await receiver.getUrl(),
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE',
    createdAt: paymentOrder.createdAt,
    firstPaymentAt: paymentOrder.firstPaymentAt,
    lastPaymentAt: paymentOrder.lastPaymentAt
  })

  t.is(paymentOrder.payments.length, 1)

  t.alike(paymentOrder.payments[0].serialize(), {
    id: paymentOrder.payments[0].id,
    orderId: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    counterpartyURL: await receiver.getUrl(),
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

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.serialize', async t => {
  const { paymentOrder, receiver, db, relay } = await getOneTimePaymentOrderEntities(t)

  const serialized = paymentOrder.serialize()
  t.alike(serialized, {
    id: null,
    clientOrderId: orderParams.clientOrderId,
    state: ORDER_STATE.CREATED,
    frequency: 0,
    counterpartyURL: await receiver.getUrl(),
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE',
    createdAt: paymentOrder.createdAt,
    firstPaymentAt: paymentOrder.firstPaymentAt,
    lastPaymentAt: paymentOrder.lastPaymentAt
  })

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.save', async t => {
  const { paymentOrder, receiver, db, relay } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()

  t.ok(paymentOrder.id)
  const gotOrder = await paymentOrder.db.getOrder(paymentOrder.id)
  t.alike(gotOrder, {
    id: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    state: ORDER_STATE.INITIALIZED,
    frequency: 0,
    counterpartyURL: await receiver.getUrl(),
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE',
    createdAt: paymentOrder.createdAt,
    firstPaymentAt: paymentOrder.firstPaymentAt,
    lastPaymentAt: paymentOrder.lastPaymentAt
  })

  const gotPayment = await paymentOrder.db.getPayment(paymentOrder.payments[0].id)
  t.alike(gotPayment, {
    id: paymentOrder.payments[0].id,
    orderId: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    counterpartyURL: await receiver.getUrl(),
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

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.update', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()
  let got

  t.ok(paymentOrder.id)
  got = await paymentOrder.db.getOrder(paymentOrder.id)
  t.is(got.amount, '100')

  paymentOrder.amount = new PaymentAmount({ amount: '101' })
  await paymentOrder.update()

  got = await paymentOrder.db.getOrder(paymentOrder.id)

  t.alike(got, paymentOrder.serialize())
  t.is(got.amount, '101')

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.getFirstOutstandingPayment', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t)
  const createRecurringPaymentSpy = sinon.spy(paymentOrder, 'createPaymentForRecurringOrder')
  let outstandingPayment

  outstandingPayment = await paymentOrder.getFirstOutstandingPayment()
  t.is(createRecurringPaymentSpy.callCount, 0)
  t.absent(outstandingPayment)

  await paymentOrder.init()
  outstandingPayment = await paymentOrder.getFirstOutstandingPayment()
  t.alike(outstandingPayment, paymentOrder.payments[0])

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.getPaymentInProgress', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t, true)
  t.absent(paymentOrder.getPaymentInProgress())

  await paymentOrder.init()
  t.absent(paymentOrder.getPaymentInProgress())

  const payment = await paymentOrder.process()
  t.alike(paymentOrder.getPaymentInProgress(), payment)

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.canProcess', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t)

  t.not(paymentOrder.canProcess())

  await paymentOrder.init()
  t.ok(paymentOrder.canProcess())

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.canProcess - failed payment', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()

  const payment = paymentOrder.payments[0]
  await payment.process()
  while (!payment.isFailed()) {
    await payment.failCurrentPlugin()
    await payment.process()
  }

  t.absent(paymentOrder.canProcess())

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.processPayment', async t => {
  const { paymentOrder, receiver, sender, db, relay } = await getOneTimePaymentOrderEntities(t, true)

  paymentOrder.id = '1234'
  await paymentOrder.init()

  t.is(paymentOrder.payments.length, 1)

  const payment = paymentOrder.payments[0].serialize()
  t.alike(payment, {
    id: payment.id,
    orderId: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    counterpartyURL: await receiver.getUrl(),
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

  res = await paymentOrder.processPayment(new PaymentObject(payment, paymentOrder.db, sender))
  t.alike(res.serialize(), payment)

  payment.executeAt = payment.executeAt - 1000000
  res = await paymentOrder.processPayment(new PaymentObject(payment, paymentOrder.db, sender))
  const serialized = res.serialize()

  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.is(serialized.currentPlugin.name, 'p2sh')

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.complete', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t, true)
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

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.process', async t => {
  const { paymentOrder, receiver, db, relay } = await getOneTimePaymentOrderEntities(t, true)
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
  t.is(serialized.counterpartyURL, await receiver.getUrl())
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
  t.is(serialized.counterpartyURL, await receiver.getUrl())
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

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.cancel', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()

  t.ok(paymentOrder.id)

  await paymentOrder.cancel()

  t.is(paymentOrder.state, ORDER_STATE.CANCELLED)
  t.is(paymentOrder.payments[0].serialize().internalState, PAYMENT_STATE.CANCELLED)

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder.find', async t => {
  const { paymentOrder, db, sender, relay } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()
  const id = paymentOrder.id

  const got = await PaymentOrder.find(id, db, sender)
  t.alike(got.serialize(), paymentOrder.serialize())

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
  })
})

test('PaymentOrder - recurring order (finite)', async t => {
  const db = new DB({ name: 'test', path: './test_db' })
  await db.init()
  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const receiver = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: {
      p2sh: '/public/p2sh.json',
      p2tr: '/public/p2tr.json'
    }
  }, { awaitRelaySync: true })

  const sender = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  const params = {
    ...orderParams,
    frequency: 1, // 1 ms
    lastPaymentAt: Date.now() + 3,
    counterpartyURL: await receiver.getUrl(),
    amount: '1'
  }

  const paymentOrder = new PaymentOrder(params, db, sender)
  await paymentOrder.init()

  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)
  // time slide
  t.ok(paymentOrder.payments.length <= 3)
  t.ok(paymentOrder.payments.length >= 2)

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    const res = await paymentOrder.process()
    t.is(res.internalState.internalState, PAYMENT_STATE.IN_PROGRESS)
    await res.complete()
    t.is(res.internalState.internalState, PAYMENT_STATE.COMPLETED)
  }

  t.teardown(async () => {
    await dropTables(db)
    await relay.close()
  })
})

test('PaymentOrder - recurring order (infinite)', async t => {
  const db = new DB({ name: 'test', path: './test_db' })
  await db.init()

  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const receiver = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: {
      p2sh: '/public/p2sh.json',
      p2tr: '/public/p2tr.json'
    }
  }, { awaitRelaySync: true })

  const sender = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  const params = {
    ...orderParams,
    frequency: 1, // 1 ms
    amount: '1',
    counterpartyURL: await receiver.getUrl()
  }

  const paymentOrder = new PaymentOrder(params, db, sender)
  await paymentOrder.init()

  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)
  t.is(paymentOrder.payments.length, 100)

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    const res = await paymentOrder.process()
    t.is(res.internalState.internalState, PAYMENT_STATE.IN_PROGRESS)
    await res.complete()
    t.is(res.internalState.internalState, PAYMENT_STATE.COMPLETED)
  }

  await paymentOrder.process()
  t.is(paymentOrder.payments.length, 200)

  t.teardown(async () => {
    await dropTables(db)
    await relay.close()
  })
})
