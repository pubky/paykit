const { test } = require('brittle')
const sinon = require('sinon')

const { DB } = require('../../src/DB')

const { paymentParams } = require('../fixtures/paymentParams')

const { Payment, PAYMENT_STATE, PLUGIN_STATE, ERRORS } = require('../../src/payments/Payment')
const { PaymentAmount } = require('../../src/payments/PaymentAmount')
const { ERRORS: STATE_ERRORS } = require('../../src/payments/PaymentState')
const createTestnet = require('@hyperswarm/testnet')
const { SlashtagsConnector, SLASHPAY_PATH } = require('../../src/slashtags')

async function createPaymentEntities (t, initializeReceiver = true, opts = {}) {
  const db = new DB()
  await db.init()

  const testnet = await createTestnet(3, t.teardown)
  const receiver = new SlashtagsConnector(testnet)
  await receiver.init()
  const sender = new SlashtagsConnector(testnet)
  await sender.init()
  const params = {
    ...paymentParams,
    counterpartyURL: opts.direction === 'IN' ? sender.getUrl() : receiver.getUrl(),
    ...opts
  }

  if (initializeReceiver) {
    await receiver.create(SLASHPAY_PATH, {
      paymentEndpoints: {
        p2sh: '/public/p2sh.json',
        p2tr: '/public/p2tr.json'
      }
    })
  }

  const payment = new Payment(params, db, sender)

  return { sender, receiver, payment, db }
}

test('Payment.generateId', t => {
  const id = Payment.generateId()
  t.ok(id)
})

test('Payment.validatePaymentParams', t => {
  t.exception(() => Payment.validatePaymentParams(), ERRORS.PARAMS_REQUIRED)

  const params = {}
  t.exception(() => Payment.validatePaymentParams(params), ERRORS.ORDER_ID_REQUIRED)

  params.orderId = 'orderId'
  t.exception(() => Payment.validatePaymentParams(params), ERRORS.CLIENT_ID_REQUIRED)

  params.clientOrderId = 'clientOrderId'
  t.exception(() => Payment.validatePaymentParams(params), ERRORS.AMOUNT_REQUIRED)

  params.amount = '100'
  t.exception(() => Payment.validatePaymentParams(params), ERRORS.COUNTERPARTY_REQUIRED)

  params.id = 'id'
  t.exception(() => Payment.validatePaymentParams(params), ERRORS.ALREADY_EXISTS('id'))

  delete params.id
  params.counterpartyURL = 'counterpartyURL'
  t.execution(() => Payment.validatePaymentParams(params))
})

test('Payment.validateDB', async t => {
  const db = new DB()
  t.exception(() => Payment.validateDB(), ERRORS.NO_DB)
  t.exception(() => Payment.validateDB(db), ERRORS.DB_NOT_READY)

  await db.init()
  t.execution(() => Payment.validateDB(db))
})

test('Payment.validatePaymentObject', t => {
  const paymentObject = {
    currency: 'BTC',
    denomination: 'BASE',
    counterpartyURL: 'counterpartyURL',
    ...paymentParams
  }

  t.exception(() => Payment.validatePaymentObject(), ERRORS.PAYMENT_OBJECT_REQUIRED)

  t.exception(() => Payment.validatePaymentObject(paymentObject), ERRORS.ID_REQUIRED)

  paymentObject.id = 'id'
  t.exception(() => Payment.validatePaymentObject(paymentObject), ERRORS.INTERNAL_STATE_REQUIRED)

  paymentObject.internalState = PAYMENT_STATE.INITIAL

  t.execution(() => Payment.validatePaymentObject(paymentObject))
})

test('Payment.validateDirection', t => {
  const paymentObject = { ...paymentParams }
  t.execution(() => Payment.validateDirection(paymentObject))

  paymentObject.direction = 'IN'
  t.exception(() => Payment.validateDirection(paymentObject), ERRORS.COMPLETED_BY_PLUGIN_REQUIRED)

  paymentObject.completedByPlugin = {}
  t.exception(() => Payment.validateDirection(paymentObject), ERRORS.COMPLETED_BY_PLUGIN_NAME_REQUIRED)

  paymentObject.completedByPlugin.name = 'test'
  t.exception(() => Payment.validateDirection(paymentObject), ERRORS.COMPLETED_BY_PLUGIN_STATE_REQUIRED)

  paymentObject.completedByPlugin.state = 'foo'
  t.exception(() => Payment.validateDirection(paymentObject), STATE_ERRORS.INVALID_STATE('foo'))

  paymentObject.completedByPlugin.state = PLUGIN_STATE.SUCCESS
  t.exception(() => Payment.validateDirection(paymentObject), ERRORS.COMPLETED_BY_PLUGIN_START_AT_REQUIRED)

  paymentObject.completedByPlugin.startAt = Date.now()
  t.execution(() => Payment.validateDirection(paymentObject))
})

test('Payment - new', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t)

  t.is(payment.id, null)
  t.alike(payment.internalState.serialize(), {
    internalState: PAYMENT_STATE.INITIAL,
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    completedByPlugin: {}
  })
  t.is(payment.counterpartyURL, receiver.getUrl())
  t.is(payment.clientOrderId, 'clientOrderId')
  t.alike(payment.amount, new PaymentAmount({
    amount: '100',
    currency: 'BTC',
    denomination: 'BASE'
  }))
  t.is(payment.memo, '')
  t.is(payment.orderId, paymentParams.orderId)
  t.ok(payment.createdAt <= Date.now())
  t.ok(payment.executeAt <= Date.now())

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment - new (incomming)', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, false, {
    direction: 'IN',
    completedByPlugin: {
      name: 'test',
      state: PLUGIN_STATE.SUCCESS,
      startAt: Date.now(),
      endAt: Date.now()
    }
  })

  t.is(payment.id, null)
  t.is(payment.counterpartyURL, sender.getUrl())
  t.is(payment.clientOrderId, 'clientOrderId')
  t.alike(payment.amount, new PaymentAmount({
    amount: '100',
    currency: 'BTC',
    denomination: 'BASE'
  }))
  t.is(payment.memo, '')
  t.is(payment.orderId, paymentParams.orderId)
  t.ok(payment.createdAt <= Date.now())
  t.ok(payment.executeAt <= Date.now())

  const internalState = payment.internalState.serialize()

  t.is(internalState.internalState, PAYMENT_STATE.COMPLETED)
  t.alike(internalState.pendingPlugins, [])
  t.alike(internalState.triedPlugins, [])
  t.alike(internalState.currentPlugin, {})

  t.is(internalState.completedByPlugin.state, PLUGIN_STATE.SUCCESS)
  t.is(internalState.completedByPlugin.name, 'test')
  t.ok(internalState.completedByPlugin.startAt <= Date.now())
  t.ok(internalState.completedByPlugin.endAt <= Date.now())

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment.init - payment file not found', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, false)

  await t.exception(async () => await payment.init(), ERRORS.PAYMENT_FILE_NOT_FOUND)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment.init - no matching plugins', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, false)
  await receiver.create(SLASHPAY_PATH, { paymentEndpoints: { paypal: '/public/paypal.json' } })

  await t.exception(async () => await payment.init(), ERRORS.NO_MATCHING_PLUGINS)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment.init - selected priority', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t)
  await payment.init()
  t.alike(payment.sendingPriority, ['p2sh', 'p2tr'])

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment.serialize', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, false)

  const serialized = payment.serialize()
  t.alike(serialized, {
    id: null,
    orderId: 'internalOrderId',
    clientOrderId: 'clientOrderId',
    internalState: PAYMENT_STATE.INITIAL,
    counterpartyURL: receiver.getUrl(),
    memo: '',
    amount: '100',
    currency: 'BTC',
    denomination: 'BASE',
    sendingPriority: ['p2sh', 'p2tr'],
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    completedByPlugin: {},
    direction: 'OUT',
    createdAt: payment.createdAt,
    executeAt: payment.executeAt
  })

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment.save - iff entry is new', async t => {
  const { sender, receiver, payment, db } = await createPaymentEntities(t, false)

  await payment.save()

  const got = await db.get(payment.id)
  t.alike(got, payment.serialize())

  await t.exception(async () => await payment.save(), ERRORS.ALREADY_EXISTS(payment.id))

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment.delete', async t => {
  const { sender, receiver, payment, db } = await createPaymentEntities(t, false)

  await payment.save()
  const { id } = payment
  await payment.delete()

  let got = await db.get(id)
  t.is(got, null)

  got = await db.get(id, { removed: true })
  t.alike(got, payment.serialize())

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment.save - fails if entry is removed', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, false)

  await payment.save()
  const { id } = payment
  await payment.delete()

  await t.exception(async () => await payment.save(), ERRORS.ALREADY_EXISTS(id))

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment.update', async t => {
  const { sender, receiver, payment, db } = await createPaymentEntities(t, false)

  await payment.save()
  const { id } = payment
  payment.amount = new PaymentAmount({ amount: '200', currency: 'BTC' })
  await payment.update()

  const got = await db.get(id)
  t.alike(got, payment.serialize())
  t.is(got.amount, '200')
  t.is(got.currency, 'BTC')

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
  })
})

test('Payment.process', async t => {
  const { sender, receiver, payment, db } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  const update = sinon.replace(db, 'update', sinon.fake(db.update))

  await payment.save()
  await payment.init()

  const process = sinon.replace(payment.internalState, 'process', sinon.fake(payment.internalState.process))

  let serialized

  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.INITIAL)
  t.alike(serialized.pendingPlugins, ['p2sh', 'p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 0)
  t.is(update.callCount, 0)

  await payment.process()
  t.is(process.callCount, 1)
  t.is(update.callCount, 2)

  payment.executeAt = new Date(Date.now() - 1)
  await payment.process()

  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['p2tr'])

  t.alike(serialized.triedPlugins, [])

  t.is(serialized.currentPlugin.name, 'p2sh')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.is(serialized.currentPlugin.state, PLUGIN_STATE.SUBMITTED)

  t.alike(serialized.completedByPlugin, {})

  t.is(process.callCount, 2)
  t.is(update.callCount, 2)

  // nothing changes as currently processed by plugin
  await payment.process()
  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.is(serialized.currentPlugin.name, 'p2sh')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.is(serialized.currentPlugin.state, PLUGIN_STATE.SUBMITTED)
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 3)
  t.is(update.callCount, 2)

  await payment.internalState.failCurrentPlugin()
  t.is(update.callCount, 3)
  await payment.process()

  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, [])

  t.is(serialized.triedPlugins.length, 1)
  t.is(serialized.triedPlugins[0].name, 'p2sh')
  t.ok(serialized.triedPlugins[0].startAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt >= serialized.triedPlugins[0].startAt)
  t.is(serialized.triedPlugins[0].state, PLUGIN_STATE.FAILED)

  t.is(serialized.currentPlugin.name, 'p2tr')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.is(serialized.currentPlugin.state, PLUGIN_STATE.SUBMITTED)

  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 4)
  t.is(update.callCount, 4)

  // nothing changes as currently processed by plugin
  await payment.process()
  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, [])
  t.is(serialized.triedPlugins.length, 1)
  t.is(serialized.triedPlugins[0].name, 'p2sh')
  t.ok(serialized.triedPlugins[0].startAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt >= serialized.triedPlugins[0].startAt)
  t.is(serialized.triedPlugins[0].state, PLUGIN_STATE.FAILED)
  t.is(serialized.currentPlugin.name, 'p2tr')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.is(serialized.currentPlugin.state, PLUGIN_STATE.SUBMITTED)
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 5)
  t.is(update.callCount, 4)

  await payment.internalState.failCurrentPlugin()
  t.is(update.callCount, 5)
  await payment.process()

  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.FAILED)
  t.alike(serialized.pendingPlugins, [])

  t.is(serialized.triedPlugins.length, 2)
  t.is(serialized.triedPlugins[0].name, 'p2sh')
  t.ok(serialized.triedPlugins[0].startAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt >= serialized.triedPlugins[0].startAt)
  t.is(serialized.triedPlugins[0].state, PLUGIN_STATE.FAILED)
  t.is(serialized.triedPlugins[1].name, 'p2tr')
  t.ok(serialized.triedPlugins[1].startAt <= Date.now())
  t.ok(serialized.triedPlugins[1].endAt <= Date.now())
  t.ok(serialized.triedPlugins[1].endAt >= serialized.triedPlugins[0].startAt)
  t.is(serialized.triedPlugins[1].state, PLUGIN_STATE.FAILED)

  t.alike(serialized.currentPlugin, {})

  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 6)
  t.is(update.callCount, 6)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
    sinon.restore()
  })
})

test('Payment.complete', async t => {
  const { sender, receiver, payment, db } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  const update = sinon.replace(db, 'update', sinon.fake(db.update))

  await payment.save()
  await payment.init()

  const process = sinon.replace(payment.internalState, 'process', sinon.fake(payment.internalState.process))
  const complete = sinon.replace(payment.internalState, 'complete', sinon.fake(payment.internalState.complete))

  let serialized
  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.INITIAL)
  t.alike(serialized.pendingPlugins, ['p2sh', 'p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 0)
  t.is(complete.callCount, 0)
  t.is(update.callCount, 0)

  await t.exception(async () => await payment.complete(), STATE_ERRORS.INVALID_STATE(PAYMENT_STATE.INITIAL))
  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.INITIAL)
  t.alike(serialized.pendingPlugins, ['p2sh', 'p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 0)
  t.is(complete.callCount, 1)
  t.is(update.callCount, 0)

  await payment.process()

  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.is(serialized.currentPlugin.name, 'p2sh')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 1)
  t.is(complete.callCount, 1)
  t.is(update.callCount, 2)

  await payment.complete()
  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.COMPLETED)
  t.alike(serialized.pendingPlugins, ['p2tr'])
  t.is(serialized.triedPlugins.length, 1)
  t.is(serialized.triedPlugins[0].name, 'p2sh')
  t.ok(serialized.triedPlugins[0].startAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt >= serialized.triedPlugins[0].startAt)
  t.alike(serialized.currentPlugin, {})
  t.is(serialized.completedByPlugin.name, 'p2sh')
  t.ok(serialized.completedByPlugin.startAt <= Date.now())
  t.ok(serialized.completedByPlugin.endAt <= Date.now())
  t.is(process.callCount, 1)
  t.is(complete.callCount, 2)
  t.is(update.callCount, 3)

  await t.exception(async () => await payment.complete(), STATE_ERRORS.INVALID_STATE(PAYMENT_STATE.COMPLETED))
  t.is(process.callCount, 1)
  t.is(complete.callCount, 3)
  t.is(update.callCount, 3)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
    sinon.restore()
  })
})

test('Payment.cancel', async t => {
  const { sender, receiver, payment, db } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  const update = sinon.replace(db, 'update', sinon.fake(db.update))

  await payment.save()
  await payment.init()
  const cancel = sinon.replace(payment.internalState, 'cancel', sinon.fake(payment.internalState.cancel))

  await payment.cancel()
  const serialized = payment.serialize()

  t.is(serialized.internalState, PAYMENT_STATE.CANCELLED)
  t.is(update.callCount, 1)
  t.is(cancel.callCount, 1)

  await t.exception(async () => await payment.cancel(), STATE_ERRORS.INVALID_STATE(PAYMENT_STATE.CANCELLED))
  t.is(update.callCount, 1)
  t.is(cancel.callCount, 2)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
    sinon.restore()
  })
})

test('Payment.getCurrentPlugin', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  payment.internalState.currentPlugin = 'test'

  const res = await payment.getCurrentPlugin()
  t.is(res, 'test')

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
    sinon.restore()
  })
})

test('Payment.isInProgress', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  await payment.init()

  t.is(payment.isInProgress(), false)
  await payment.process()
  t.is(payment.isInProgress(), true)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
    sinon.restore()
  })
})

test('Payment.failCurrentPlugin', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, true, {
    id: 'test',
    executeAt: new Date(Date.now() + 100000),
    pendingPlugins: paymentParams.sendingPriority
  })

  await payment.init()

  const fail = sinon.replace(
    payment.internalState,
    'failCurrentPlugin',
    sinon.fake(payment.internalState.failCurrentPlugin)
  )

  t.is(payment.isInProgress(), false)
  await payment.process()
  t.is(payment.isInProgress(), true)

  await payment.failCurrentPlugin()

  t.is(fail.callCount, 1)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
    sinon.restore()
  })
})

test('Payment.isFinal', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, true, {
    id: 'test',
    executeAt: new Date(Date.now() + 100000),
    pendingPlugins: paymentParams.sendingPriority
  })
  await payment.init()

  const isFinal = sinon.replace(
    payment.internalState,
    'isFinal',
    sinon.fake(payment.internalState.isFinal)
  )

  t.is(payment.isFinal(), false)
  t.is(isFinal.callCount, 1)

  await payment.process()
  t.is(payment.isFinal(), false)
  t.is(isFinal.callCount, 2)

  await payment.complete()
  t.is(payment.isFinal(), true)
  t.is(isFinal.callCount, 3)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
    sinon.restore()
  })
})

test('Payment.isFailed', async t => {
  const { sender, receiver, payment } = await createPaymentEntities(t, true, {
    id: 'test',
    executeAt: new Date(Date.now() + 100000),
    pendingPlugins: paymentParams.sendingPriority
  })
  await payment.init()

  const isFailed = sinon.replace(
    payment.internalState,
    'isFailed',
    sinon.fake(payment.internalState.isFailed)
  )

  t.is(payment.isFailed(), false)
  t.is(isFailed.callCount, 1)

  await payment.process()
  await payment.failCurrentPlugin()

  t.is(payment.isFailed(), false)
  t.is(isFailed.callCount, 2)

  await payment.process()
  await payment.failCurrentPlugin()

  t.is(payment.isFailed(), false)
  t.is(isFailed.callCount, 3)

  await payment.process()

  t.is(payment.isFailed(), true)
  t.is(isFailed.callCount, 4)

  t.teardown(async () => {
    await receiver.close()
    await sender.close()
    sinon.restore()
  })
})
