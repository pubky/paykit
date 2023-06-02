const { test } = require('brittle')
const sinon = require('sinon')

const { DB } = require('../../src/DB')

const { PLUGIN_STATE, PAYMENT_STATE } = require('../../src/payments/PaymentState')
const { PaymentAmount } = require('../../src/payments/PaymentAmount')
const { Payment } = require('../../src/payments/Payment')

const { orderParams } = require('../fixtures/paymentParams')

const { PaymentOrder, ORDER_STATE, ERRORS } = require('../../src/payments/PaymentOrder')
const createTestnet = require('@hyperswarm/testnet')
const { SlashtagsConnector, SLASHPAY_PATH } = require('../../src/slashtags')

async function getOneTimePaymentOrderEntities (t, initializeReceiver = false, opts = {}) {
  const db = new DB()
  await db.init()

  const testnet = await createTestnet(3, t)
  const receiver = new SlashtagsConnector(testnet)
  await receiver.init()
  const sender = new SlashtagsConnector(testnet)
  await sender.init()

  const params = {
    ...orderParams,
    counterpartyURL: receiver.getUrl(),
    ...opts
  }

  if (initializeReceiver) {
    await receiver.create(SLASHPAY_PATH, {
      paymentEndpoints: {
        p2sh: '/public/p2sh.json',
        lightning: '/public/lightning.json'
      }
    })
  }

  const paymentOrder = new PaymentOrder(params, db, sender)

  return {
    db,
    paymentOrder,
    receiver,
    sender
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test('PaymentOrder - new (default one time)', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t)

  t.alike(paymentOrder.orderParams, {
    ...orderParams,
    counterpartyURL: receiver.getUrl()
  })
  t.is(paymentOrder.clientOrderId, orderParams.clientOrderId)
  t.alike(paymentOrder.payments, [])

  t.is(paymentOrder.frequency, 0)

  t.is(paymentOrder.state, ORDER_STATE.CREATED)

  t.alike(paymentOrder.amount, new PaymentAmount(orderParams))
  t.is(paymentOrder.counterpartyURL, receiver.getUrl())
  t.is(paymentOrder.memo, orderParams.memo || '')

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder - new (invalid frequency)', async t => {
  const db = new DB()
  await db.init()

  const params = { ...orderParams, frequency: 'a' }

  t.exception(() => { new PaymentOrder(params, db) }, ERRORS.INVALID_FREQUENCY('a')) // eslint-disable-line 
})

test('PaymentOrder.init', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t)
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
    counterpartyURL: receiver.getUrl(),
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
    counterpartyURL: receiver.getUrl(),
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
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.serialize', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t)

  const serialized = paymentOrder.serialize()
  t.alike(serialized, {
    id: null,
    clientOrderId: orderParams.clientOrderId,
    state: ORDER_STATE.CREATED,
    frequency: 0,
    counterpartyURL: receiver.getUrl(),
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE'
  })

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.save', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()

  t.ok(paymentOrder.id)
  const gotOrder = await paymentOrder.db.get(paymentOrder.id)
  t.alike(gotOrder, {
    id: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    state: ORDER_STATE.INITIALIZED,
    frequency: 0,
    counterpartyURL: receiver.getUrl(),
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
    counterpartyURL: receiver.getUrl(),
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
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.update', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t)
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

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.getFirstOutstandingPayment', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t)
  const createRecurringPaymentSpy = sinon.spy(paymentOrder, 'createPaymentForRecurringOrder')
  let outstandingPayment

  outstandingPayment = await paymentOrder.getFirstOutstandingPayment()
  t.is(createRecurringPaymentSpy.callCount, 0)
  t.absent(outstandingPayment)

  await paymentOrder.init()
  outstandingPayment = await paymentOrder.getFirstOutstandingPayment()
  t.alike(outstandingPayment, paymentOrder.payments[0])

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.getPaymentInProgress', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t, true)
  t.absent(paymentOrder.getPaymentInProgress())

  await paymentOrder.init()
  t.absent(paymentOrder.getPaymentInProgress())

  const payment = await paymentOrder.process()
  t.alike(paymentOrder.getPaymentInProgress(), payment)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.canProcess', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t)

  t.not(paymentOrder.canProcess())

  await paymentOrder.init()
  t.ok(paymentOrder.canProcess())

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.processPayment', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t, true)

  paymentOrder.id = '1234'
  await paymentOrder.init()

  t.is(paymentOrder.payments.length, 1)

  const payment = paymentOrder.payments[0].serialize()
  t.alike(payment, {
    id: payment.id,
    orderId: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    counterpartyURL: receiver.getUrl(),
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

  res = await paymentOrder.processPayment(new Payment(payment, paymentOrder.db, sender))
  t.alike(res.serialize(), payment)

  payment.executeAt = payment.executeAt - 1000000
  res = await paymentOrder.processPayment(new Payment(payment, paymentOrder.db, sender))
  const serialized = res.serialize()

  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.is(serialized.currentPlugin.name, 'p2sh')

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.complete', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t, true)
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
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.process', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t, true)
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
  t.is(serialized.counterpartyURL, receiver.getUrl())
  t.is(serialized.memo, '')
  t.alike(serialized.sendingPriority, orderParams.sendingPriority)
  t.is(serialized.amount, orderParams.amount)
  t.is(serialized.currency, 'BTC')
  t.is(serialized.denomination, 'BASE')
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['lightning'])
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
  t.is(serialized.counterpartyURL, receiver.getUrl())
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

  t.is(serialized.currentPlugin.name, 'lightning')
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
  t.is(serialized.triedPlugins[1].name, 'lightning')
  t.is(serialized.triedPlugins[1].state, PLUGIN_STATE.SUCCESS)
  t.is(serialized.completedByPlugin.name, 'lightning')
  t.is(serialized.completedByPlugin.state, PLUGIN_STATE.SUCCESS)
  t.ok(serialized.completedByPlugin.startAt <= Date.now())
  t.ok(serialized.completedByPlugin.endAt <= Date.now())

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.cancel', async t => {
  const { paymentOrder, receiver, sender } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()

  t.ok(paymentOrder.id)

  await paymentOrder.cancel()

  t.is(paymentOrder.state, ORDER_STATE.CANCELLED)
  t.is(paymentOrder.payments[0].serialize().internalState, PAYMENT_STATE.CANCELLED)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder.find', async t => {
  const { paymentOrder, db, receiver, sender } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()
  const id = paymentOrder.id

  const got = await PaymentOrder.find(id, db, sender)
  t.alike(got.serialize(), paymentOrder.serialize())

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder - recurring order (finite)', async t => {
  const db = new DB()
  await db.init()

  const testnet = await createTestnet(3, t.teardown)
  const receiver = new SlashtagsConnector(testnet)
  await receiver.init()
  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: {
      p2sh: '/public/p2sh.json',
      lightning: '/public/lightning.json'
    }
  })

  const sender = new SlashtagsConnector(testnet)
  await sender.init()

  const params = {
    ...orderParams,
    frequency: 1, // 1 ms
    lastPaymentAt: Date.now() + 3,
    counterpartyURL: receiver.getUrl(),
    amount: '1'
  }

  const paymentOrder = new PaymentOrder(params, db, sender)
  await paymentOrder.init()

  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)
  t.is(paymentOrder.payments.length, 3)

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    // TODO: remove when id is generated
    paymentOrder.payments[i].id = paymentOrder.payments[i].id + i
  }

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    const res = await paymentOrder.process()
    t.is(res.internalState.internalState, PAYMENT_STATE.IN_PROGRESS)
    await res.complete()
    t.is(res.internalState.internalState, PAYMENT_STATE.COMPLETED)
    await sleep(1)
  }

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('PaymentOrder - recurring order (infinite)', async t => {
  const db = new DB()
  await db.init()

  const testnet = await createTestnet(3, t.teardown)
  const receiver = new SlashtagsConnector(testnet)
  await receiver.init()
  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: {
      p2sh: '/public/p2sh.json',
      lightning: '/public/lightning.json'
    }
  })

  const sender = new SlashtagsConnector(testnet)
  await sender.init()
  const params = {
    ...orderParams,
    frequency: 1, // 1 ms
    amount: '1',
    counterpartyURL: receiver.getUrl()
  }

  const paymentOrder = new PaymentOrder(params, db, sender)
  await paymentOrder.init()

  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)
  t.is(paymentOrder.payments.length, 100)

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    // TODO: remove when id is generated
    paymentOrder.payments[i].id = paymentOrder.payments[i].id + i
  }

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    const res = await paymentOrder.process()
    t.is(res.internalState.internalState, PAYMENT_STATE.IN_PROGRESS)
    await res.complete()
    t.is(res.internalState.internalState, PAYMENT_STATE.COMPLETED)
    await sleep(1)
  }

  try {
    // TODO: remove when id is generated
    await paymentOrder.process()
  } catch (err) {
    // needs an ID generator
  } finally {
    t.is(paymentOrder.payments.length, 200)
  }

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})
