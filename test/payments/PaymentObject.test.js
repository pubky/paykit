const { test } = require('brittle')
const sinon = require('sinon')
const { Relay } = require('@synonymdev/web-relay')

const { DB } = require('../../src/DB')

const { paymentParams } = require('../fixtures/paymentParams')

const { PaymentObject, PAYMENT_STATE, PLUGIN_STATE, ERRORS } = require('../../src/payments/PaymentObject')
const { PaymentAmount } = require('../../src/payments/PaymentAmount')
const { ERRORS: STATE_ERRORS } = require('../../src/payments/PaymentState')
const { SlashtagsConnector, SLASHPAY_PATH } = require('../../src/slashtags')
const { dropTables, tmpdir } = require('../helpers')

async function createPaymentEntities (t, initializeReceiver = true, opts = {}) {
  const db = new DB({ name: 'test', path: './test_db' })
  await db.init()

  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const receiver = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  const sender = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  const params = {
    ...paymentParams,
    counterpartyURL: opts.direction === 'IN' ? await sender.getUrl() : await receiver.getUrl(),
    ...opts
  }

  if (initializeReceiver) {
    await receiver.create(SLASHPAY_PATH, {
      paymentEndpoints: {
        p2sh: '/public/p2sh.json',
        p2tr: '/public/p2tr.json'
      }
    }, { awaitRelaySync: true })
  }

  const paymentObject = new PaymentObject(params, db, sender)

  return { sender, receiver, paymentObject, db, relay }
}

test('PaymentObject.generateId', t => {
  const id = PaymentObject.generateId()
  t.ok(id)
})

test('PaymentObject.validatePaymentParams', t => {
  t.exception(() => PaymentObject.validatePaymentParams(), ERRORS.PARAMS_REQUIRED)

  const params = {}
  t.exception(() => PaymentObject.validatePaymentParams(params), ERRORS.ORDER_ID_REQUIRED)

  params.orderId = 'orderId'
  t.exception(() => PaymentObject.validatePaymentParams(params), ERRORS.CLIENT_ID_REQUIRED)

  params.clientOrderId = 'clientOrderId'
  t.exception(() => PaymentObject.validatePaymentParams(params), ERRORS.AMOUNT_REQUIRED)

  params.amount = '100'
  t.exception(() => PaymentObject.validatePaymentParams(params), ERRORS.COUNTERPARTY_REQUIRED)

  params.id = 'id'
  t.exception(() => PaymentObject.validatePaymentParams(params), ERRORS.ALREADY_EXISTS('id'))

  delete params.id
  params.counterpartyURL = 'counterpartyURL'
  t.execution(() => PaymentObject.validatePaymentParams(params))
})

test('PaymentObject.validateDB', async t => {
  const db = new DB({ name: 'test', path: './test_db' })
  t.exception(() => PaymentObject.validateDB(), ERRORS.NO_DB)
  t.exception(() => PaymentObject.validateDB(db), ERRORS.DB_NOT_READY)

  await db.init()
  t.execution(() => PaymentObject.validateDB(db))

  await t.teardown(async () => await dropTables(db))
})

test('PaymentObject.validatePaymentObject', t => {
  const paymentObject = {
    currency: 'BTC',
    denomination: 'BASE',
    counterpartyURL: 'counterpartyURL',
    ...paymentParams
  }

  t.exception(() => PaymentObject.validatePaymentObject(), ERRORS.PAYMENT_OBJECT_REQUIRED)

  t.exception(() => PaymentObject.validatePaymentObject(paymentObject), ERRORS.ID_REQUIRED)

  paymentObject.id = 'id'
  t.exception(() => PaymentObject.validatePaymentObject(paymentObject), ERRORS.INTERNAL_STATE_REQUIRED)

  paymentObject.internalState = PAYMENT_STATE.INITIAL

  t.execution(() => PaymentObject.validatePaymentObject(paymentObject))
})

test('PaymentObject.validateDirection', t => {
  const paymentObject = { ...paymentParams }
  t.execution(() => PaymentObject.validateDirection(paymentObject))

  paymentObject.direction = 'IN'
  t.exception(() => PaymentObject.validateDirection(paymentObject), ERRORS.COMPLETED_BY_PLUGIN_REQUIRED)

  paymentObject.completedByPlugin = {}
  t.exception(() => PaymentObject.validateDirection(paymentObject), ERRORS.COMPLETED_BY_PLUGIN_NAME_REQUIRED)

  paymentObject.completedByPlugin.name = 'test'
  t.exception(() => PaymentObject.validateDirection(paymentObject), ERRORS.COMPLETED_BY_PLUGIN_STATE_REQUIRED)

  paymentObject.completedByPlugin.state = 'foo'
  t.exception(() => PaymentObject.validateDirection(paymentObject), STATE_ERRORS.INVALID_STATE('foo'))

  paymentObject.completedByPlugin.state = PLUGIN_STATE.SUCCESS
  t.exception(() => PaymentObject.validateDirection(paymentObject), ERRORS.COMPLETED_BY_PLUGIN_START_AT_REQUIRED)

  paymentObject.completedByPlugin.startAt = Date.now()
  t.execution(() => PaymentObject.validateDirection(paymentObject))
})

test('PaymentObject - new', async t => {
  const { receiver, paymentObject, db, relay } = await createPaymentEntities(t)

  t.is(paymentObject.id, null)
  t.alike(paymentObject.internalState.serialize(), {
    internalState: PAYMENT_STATE.INITIAL,
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    completedByPlugin: {}
  })
  t.is(paymentObject.counterpartyURL, await receiver.getUrl())
  t.ok(paymentObject.clientOrderId, 'clientOrderId')
  t.alike(paymentObject.amount, new PaymentAmount({
    amount: '100',
    currency: 'BTC',
    denomination: 'BASE'
  }))
  t.is(paymentObject.memo, '')
  t.is(paymentObject.orderId, paymentParams.orderId)
  t.ok(paymentObject.createdAt <= Date.now())
  t.ok(paymentObject.executeAt <= Date.now())

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject - new (incomming)', async t => {
  const { sender, paymentObject, db, relay } = await createPaymentEntities(t, false, {
    direction: 'IN',
    completedByPlugin: {
      name: 'test',
      state: PLUGIN_STATE.SUCCESS,
      startAt: Date.now(),
      endAt: Date.now()
    }
  })

  t.is(paymentObject.id, null)
  t.is(paymentObject.counterpartyURL, await sender.getUrl())
  t.is(paymentObject.clientOrderId, 'clientOrderId')
  t.alike(paymentObject.amount, new PaymentAmount({
    amount: '100',
    currency: 'BTC',
    denomination: 'BASE'
  }))
  t.is(paymentObject.memo, '')
  t.is(paymentObject.orderId, paymentParams.orderId)
  t.ok(paymentObject.createdAt <= Date.now())
  t.ok(paymentObject.executeAt <= Date.now())

  const internalState = paymentObject.internalState.serialize()

  t.is(internalState.internalState, PAYMENT_STATE.COMPLETED)
  t.alike(internalState.pendingPlugins, [])
  t.alike(internalState.triedPlugins, [])
  t.alike(internalState.currentPlugin, {})

  t.is(internalState.completedByPlugin.state, PLUGIN_STATE.SUCCESS)
  t.is(internalState.completedByPlugin.name, 'test')
  t.ok(internalState.completedByPlugin.startAt <= Date.now())
  t.ok(internalState.completedByPlugin.endAt <= Date.now())

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject.init - paymentObject file not found', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, false)

  await t.exception(async () => await paymentObject.init(), ERRORS.PAYMENT_FILE_NOT_FOUND)

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject.init - no matching plugins', async t => {
  const { receiver, paymentObject, db, relay } = await createPaymentEntities(t, false)
  await receiver.create(SLASHPAY_PATH, { paymentEndpoints: { paypal: '/public/paypal.json' } })

  await t.exception(async () => await paymentObject.init(), ERRORS.NO_MATCHING_PLUGINS)

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject.init - selected priority', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t)
  await paymentObject.init()
  t.alike(paymentObject.sendingPriority, ['p2sh', 'p2tr'])

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject.serialize', async t => {
  const { receiver, paymentObject, db, relay } = await createPaymentEntities(t, false)

  const serialized = paymentObject.serialize()
  t.alike(serialized, {
    id: null,
    orderId: paymentObject.orderId,
    clientOrderId: paymentObject.clientOrderId,
    internalState: PAYMENT_STATE.INITIAL,
    counterpartyURL: await receiver.getUrl(),
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
    createdAt: paymentObject.createdAt,
    executeAt: paymentObject.executeAt
  })

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject.save - iff entry is new', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, false)

  await paymentObject.save()

  const got = await db.getPayment(paymentObject.id)
  t.alike(got, paymentObject.serialize())

  await t.exception(async () => await paymentObject.save(), ERRORS.ALREADY_EXISTS(paymentObject.id))

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject.delete', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, false)

  await paymentObject.save()
  const { id } = paymentObject
  await paymentObject.delete()

  let got = await db.getPayment(id)
  t.is(got, null)

  got = await db.getPayment(id, { removed: true })
  t.alike(got, paymentObject.serialize())

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject.save - fails if entry is removed', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, false)

  await paymentObject.save()
  const { id } = paymentObject
  await paymentObject.delete()

  await t.exception(async () => await paymentObject.save(), ERRORS.ALREADY_EXISTS(id))

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject.update', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, false)

  await paymentObject.save()
  const { id } = paymentObject
  paymentObject.amount = new PaymentAmount({ amount: '200', currency: 'BTC' })
  await paymentObject.update()

  const got = await db.getPayment(id)
  t.alike(got, paymentObject.serialize())
  t.is(got.amount, '200')
  t.is(got.currency, 'BTC')

  t.teardown(async () => {
    await dropTables(db)
    relay.close()
  })
})

test('PaymentObject.process', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  const update = sinon.replace(db, 'updatePayment', sinon.fake(db.updatePayment))

  await paymentObject.save()
  await paymentObject.init()

  const process = sinon.replace(paymentObject.internalState, 'process', sinon.fake(paymentObject.internalState.process))

  let serialized

  serialized = paymentObject.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.INITIAL)
  t.alike(serialized.pendingPlugins, ['p2sh', 'p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 0)
  t.is(update.callCount, 0)

  await paymentObject.process()
  t.is(process.callCount, 1)
  t.is(update.callCount, 2)

  paymentObject.executeAt = new Date(Date.now() - 1)
  await paymentObject.process()

  serialized = paymentObject.serialize()
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
  await paymentObject.process()
  serialized = paymentObject.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.is(serialized.currentPlugin.name, 'p2sh')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.is(serialized.currentPlugin.state, PLUGIN_STATE.SUBMITTED)
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 3)
  t.is(update.callCount, 2)

  await paymentObject.internalState.failCurrentPlugin()
  t.is(update.callCount, 3)
  await paymentObject.process()

  serialized = paymentObject.serialize()
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
  await paymentObject.process()
  serialized = paymentObject.serialize()
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

  await paymentObject.internalState.failCurrentPlugin()
  t.is(update.callCount, 5)
  await paymentObject.process()

  serialized = paymentObject.serialize()
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
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentObject.complete', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  const update = sinon.replace(db, 'updatePayment', sinon.fake(db.updatePayment))

  await paymentObject.save()
  await paymentObject.init()

  const process = sinon.replace(paymentObject.internalState, 'process', sinon.fake(paymentObject.internalState.process))
  const complete = sinon.replace(paymentObject.internalState, 'complete', sinon.fake(paymentObject.internalState.complete))

  let serialized
  serialized = paymentObject.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.INITIAL)
  t.alike(serialized.pendingPlugins, ['p2sh', 'p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 0)
  t.is(complete.callCount, 0)
  t.is(update.callCount, 0)

  await t.exception(async () => await paymentObject.complete(), STATE_ERRORS.INVALID_STATE(PAYMENT_STATE.INITIAL))
  serialized = paymentObject.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.INITIAL)
  t.alike(serialized.pendingPlugins, ['p2sh', 'p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 0)
  t.is(complete.callCount, 1)
  t.is(update.callCount, 0)

  await paymentObject.process()

  serialized = paymentObject.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['p2tr'])
  t.alike(serialized.triedPlugins, [])
  t.is(serialized.currentPlugin.name, 'p2sh')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.alike(serialized.completedByPlugin, {})
  t.is(process.callCount, 1)
  t.is(complete.callCount, 1)
  t.is(update.callCount, 2)

  await paymentObject.complete()
  serialized = paymentObject.serialize()
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

  await t.exception(async () => await paymentObject.complete(), STATE_ERRORS.INVALID_STATE(PAYMENT_STATE.COMPLETED))
  t.is(process.callCount, 1)
  t.is(complete.callCount, 3)
  t.is(update.callCount, 3)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentObject.cancel', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  const update = sinon.replace(db, 'updatePayment', sinon.fake(db.updatePayment))

  await paymentObject.save()
  await paymentObject.init()
  const cancel = sinon.replace(paymentObject.internalState, 'cancel', sinon.fake(paymentObject.internalState.cancel))

  await paymentObject.cancel()
  const serialized = paymentObject.serialize()

  t.is(serialized.internalState, PAYMENT_STATE.CANCELLED)
  t.is(update.callCount, 1)
  t.is(cancel.callCount, 1)

  await t.exception(async () => await paymentObject.cancel(), STATE_ERRORS.INVALID_STATE(PAYMENT_STATE.CANCELLED))
  t.is(update.callCount, 1)
  t.is(cancel.callCount, 2)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentObject.getCurrentPlugin', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  paymentObject.internalState.currentPlugin = 'test'

  const res = await paymentObject.getCurrentPlugin()
  t.is(res, 'test')

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentObject.isInProgress', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, true, {
    executeAt: new Date(Date.now() + 100000)
  })
  await paymentObject.init()

  t.is(paymentObject.isInProgress(), false)
  await paymentObject.process()
  t.is(paymentObject.isInProgress(), true)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentObject.failCurrentPlugin', async t => {
  const { relay, paymentObject, db } = await createPaymentEntities(t, true, {
    id: 'test',
    executeAt: new Date(Date.now() + 100000),
    pendingPlugins: paymentParams.sendingPriority
  })

  await paymentObject.init()

  const fail = sinon.replace(
    paymentObject.internalState,
    'failCurrentPlugin',
    sinon.fake(paymentObject.internalState.failCurrentPlugin)
  )

  t.is(paymentObject.isInProgress(), false)
  await paymentObject.process()
  t.is(paymentObject.isInProgress(), true)

  await paymentObject.failCurrentPlugin()

  t.is(fail.callCount, 1)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentObject.isFinal', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, true, {
    id: 'test',
    executeAt: new Date(Date.now() + 100000),
    pendingPlugins: paymentParams.sendingPriority
  })
  await paymentObject.init()

  const isFinal = sinon.replace(
    paymentObject.internalState,
    'isFinal',
    sinon.fake(paymentObject.internalState.isFinal)
  )

  t.is(paymentObject.isFinal(), false)
  t.is(isFinal.callCount, 1)

  await paymentObject.process()
  t.is(paymentObject.isFinal(), false)
  t.is(isFinal.callCount, 2)

  await paymentObject.complete()
  t.is(paymentObject.isFinal(), true)
  t.is(isFinal.callCount, 3)

  t.teardown(async () => {
    await dropTables(db)
    sinon.restore()
    relay.close()
  })
})

test('PaymentObject.isFailed', async t => {
  const { paymentObject, db, relay } = await createPaymentEntities(t, true, {
    id: 'test',
    executeAt: new Date(Date.now() + 100000),
    pendingPlugins: paymentParams.sendingPriority
  })
  await paymentObject.init()

  const isFailed = sinon.replace(
    paymentObject.internalState,
    'isFailed',
    sinon.fake(paymentObject.internalState.isFailed)
  )

  t.is(paymentObject.isFailed(), false)
  t.is(isFailed.callCount, 1)

  await paymentObject.process()
  await paymentObject.failCurrentPlugin()

  t.is(paymentObject.isFailed(), false)
  t.is(isFailed.callCount, 2)

  await paymentObject.process()
  await paymentObject.failCurrentPlugin()

  t.is(paymentObject.isFailed(), false)
  t.is(isFailed.callCount, 3)

  await paymentObject.process()

  t.is(paymentObject.isFailed(), true)
  t.is(isFailed.callCount, 4)

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)
    sinon.restore()
  })
})
