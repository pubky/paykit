const { test } = require('brittle')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

const { DB } = require('../../src/DB')

const { paymentParams } = require('../fixtures/paymentParams')

const { Payment, PAYMENT_STATE, PLUGIN_STATE, ERRORS } = require('../../src/payments/Payment')
const { PaymentAmount } = require('../../src/payments/PaymentAmount')
const { ERRORS: STATE_ERRORS } = require('../../src/payments/PaymentState')

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
  t.exception(() => Payment.validatePaymentParams(params), ERRORS.TARGET_REQUIRED)

  params.id = 'id'
  t.exception(() => Payment.validatePaymentParams(params), ERRORS.ALREADY_EXISTS('id'))

  delete params.id
  params.targetURL = 'targetURL'
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
  // TODO: add more tests
  const paymentObject = {
    id: 'id',
    internalState: PAYMENT_STATE.INITIAL,
    currency: 'BTC',
    denomination: 'BASE',
    sendingPriority: ['p2sh', 'lightning'],
    ...paymentParams
  }
  t.execution(() => Payment.validatePaymentObject(paymentObject))
})

test('Payment - new', async t => {
  const db = new DB()
  await db.init()

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)

  t.is(payment.id, null)
  t.alike(payment.internalState.serialize(), {
    internalState: PAYMENT_STATE.INITIAL,
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    sentByPlugin: {}
  })
  t.is(payment.targetURL, 'slashpay://driveKey/slashpay.json')
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
})

test('Payment.init - payment file not found', async t => {
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () {
          this.ready = false
        }

        async init () { this.ready = true }
        async read () { return null }
      }
    }
  })
  const db = new DB()
  await db.init()

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)

  await t.exception(async () => await payment.init(), ERRORS.PAYMENT_FILE_NOT_FOUND)
})

test('Payment.init - no matching plugins', async t => {
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () {
          this.ready = false
        }

        async init () { this.ready = true }
        async read () {
          return {
            paymentEndpoints: { paypal: '/paypal/slashpay.json' }
          }
        }
      }
    }
  })
  const db = new DB()
  await db.init()

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)

  await t.exception(async () => await payment.init(), ERRORS.NO_MATCHING_PLUGINS)
})

test('Payment.init - selected priority', async t => {
  const db = new DB()
  await db.init()

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)
  await payment.init()
  t.alike(payment.sendingPriority, ['p2sh', 'lightning'])
})

test('Payment.serialize', async t => {
  const db = new DB()
  await db.init()

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)
  const serialized = payment.serialize()
  t.alike(serialized, {
    id: null,
    orderId: 'internalOrderId',
    clientOrderId: 'clientOrderId',
    internalState: PAYMENT_STATE.INITIAL,
    targetURL: 'slashpay://driveKey/slashpay.json',
    memo: '',
    amount: '100',
    currency: 'BTC',
    denomination: 'BASE',
    sendingPriority: ['p2sh', 'lightning'],
    pendingPlugins: [],
    triedPlugins: [],
    currentPlugin: {},
    sentByPlugin: {},
    createdAt: payment.createdAt,
    executeAt: payment.executeAt
  })
})

test('Payment.save - iff entry is new', async t => {
  const db = new DB()
  await db.init()
  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)
  await payment.save()
  const got = await db.get(payment.id)
  t.alike(got, payment.serialize())

  await t.exception(async () => await payment.save(), ERRORS.ALREADY_EXISTS(payment.id))
})

test('Payment.save - overwites id if entry not found in DB', async t => {
  const db = new DB()
  await db.init()

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)
  payment.id = 'new-totally-random-id'
  await payment.save()
  const got = await db.get(payment.id)
  t.alike(got, payment.serialize())
  t.not(got.id, 'new-totally-random-id')
  t.not(payment.id, 'new-totally-random-id')
})

test('Payment.delete', async t => {
  const db = new DB()
  await db.init()

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)
  await payment.save()
  const { id } = payment
  await payment.delete()

  let got = await db.get(id)
  t.is(got, null)

  got = await db.get(id, { removed: true })
  t.alike(got, payment.serialize())
})

test('Payment.save - fails if entry is removed', async t => {
  const db = new DB()
  await db.init()

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)
  await payment.save()
  const { id } = payment
  await payment.delete()

  await t.exception(async () => await payment.save(), ERRORS.ALREADY_EXISTS(id))
})

test('Payment.update', async t => {
  const db = new DB()
  await db.init()

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning'] }, db)
  await payment.save()
  const { id } = payment
  payment.amount = new PaymentAmount({ amount: '200', currency: 'BTC' })
  await payment.update()

  const got = await db.get(id)
  t.alike(got, payment.serialize())
  t.is(got.amount, '200')
  t.is(got.currency, 'BTC')
})

test('Payment.process', async t => {
  const db = new DB()
  await db.init()
  const update = sinon.replace(db, 'update', sinon.fake(db.update))

  const payment = new Payment({
    ...paymentParams,
    executeAt: new Date(Date.now() + 100000),
    sendingPriority: ['p2sh', 'lightning']
  }, db)
  await payment.save()
  await payment.init()

  const process = sinon.replace(payment.internalState, 'process', sinon.fake(payment.internalState.process))

  let serialized

  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.INITIAL)
  t.alike(serialized.pendingPlugins, ['p2sh', 'lightning'])
  t.alike(serialized.triedPlugins, [])
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.sentByPlugin, {})
  t.is(process.callCount, 0)
  t.is(update.callCount, 0)

  await payment.process()
  t.is(process.callCount, 1)
  t.is(update.callCount, 2)

  payment.executeAt = new Date(Date.now() - 1)
  await payment.process()

  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['lightning'])

  t.alike(serialized.triedPlugins, [])

  t.is(serialized.currentPlugin.name, 'p2sh')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.is(serialized.currentPlugin.state, PLUGIN_STATE.SUBMITTED)

  t.alike(serialized.sentByPlugin, {})

  t.is(process.callCount, 2)
  t.is(update.callCount, 2)

  // nothing changes as currently processed by plugin
  await payment.process()
  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['lightning'])
  t.alike(serialized.triedPlugins, [])
  t.is(serialized.currentPlugin.name, 'p2sh')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.is(serialized.currentPlugin.state, PLUGIN_STATE.SUBMITTED)
  t.alike(serialized.sentByPlugin, {})
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

  t.is(serialized.currentPlugin.name, 'lightning')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.is(serialized.currentPlugin.state, PLUGIN_STATE.SUBMITTED)

  t.alike(serialized.sentByPlugin, {})
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
  t.is(serialized.currentPlugin.name, 'lightning')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.is(serialized.currentPlugin.state, PLUGIN_STATE.SUBMITTED)
  t.alike(serialized.sentByPlugin, {})
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
  t.is(serialized.triedPlugins[1].name, 'lightning')
  t.ok(serialized.triedPlugins[1].startAt <= Date.now())
  t.ok(serialized.triedPlugins[1].endAt <= Date.now())
  t.ok(serialized.triedPlugins[1].endAt >= serialized.triedPlugins[0].startAt)
  t.is(serialized.triedPlugins[1].state, PLUGIN_STATE.FAILED)

  t.alike(serialized.currentPlugin, {})

  t.alike(serialized.sentByPlugin, {})
  t.is(process.callCount, 6)
  t.is(update.callCount, 6)

  t.teardown(() => sinon.restore())
})

test('Payment.complete', async t => {
  const db = new DB()
  await db.init()
  const update = sinon.replace(db, 'update', sinon.fake(db.update))

  const payment = new Payment({ ...paymentParams, sendingPriority: ['p2sh', 'lightning', 'p2wsh'] }, db)
  await payment.save()
  await payment.init()
  const process = sinon.replace(payment.internalState, 'process', sinon.fake(payment.internalState.process))
  const complete = sinon.replace(payment.internalState, 'complete', sinon.fake(payment.internalState.complete))

  let serialized
  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.INITIAL)
  t.alike(serialized.pendingPlugins, ['p2sh', 'lightning'])
  t.alike(serialized.triedPlugins, [])
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.sentByPlugin, {})
  t.is(process.callCount, 0)
  t.is(complete.callCount, 0)
  t.is(update.callCount, 0)

  await t.exception(async () => await payment.complete(), STATE_ERRORS.INVALID_STATE(PAYMENT_STATE.INITIAL))
  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.INITIAL)
  t.alike(serialized.pendingPlugins, ['p2sh', 'lightning'])
  t.alike(serialized.triedPlugins, [])
  t.alike(serialized.currentPlugin, {})
  t.alike(serialized.sentByPlugin, {})
  t.is(process.callCount, 0)
  t.is(complete.callCount, 1)
  t.is(update.callCount, 0)

  await payment.process()

  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.alike(serialized.pendingPlugins, ['lightning'])
  t.alike(serialized.triedPlugins, [])
  t.is(serialized.currentPlugin.name, 'p2sh')
  t.ok(serialized.currentPlugin.startAt <= Date.now())
  t.alike(serialized.sentByPlugin, {})
  t.is(process.callCount, 1)
  t.is(complete.callCount, 1)
  t.is(update.callCount, 2)

  await payment.complete()
  serialized = payment.serialize()
  t.is(serialized.internalState, PAYMENT_STATE.COMPLETED)
  t.alike(serialized.pendingPlugins, ['lightning'])
  t.is(serialized.triedPlugins.length, 1)
  t.is(serialized.triedPlugins[0].name, 'p2sh')
  t.ok(serialized.triedPlugins[0].startAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt <= Date.now())
  t.ok(serialized.triedPlugins[0].endAt >= serialized.triedPlugins[0].startAt)
  t.alike(serialized.currentPlugin, {})
  t.is(serialized.sentByPlugin.name, 'p2sh')
  t.ok(serialized.sentByPlugin.startAt <= Date.now())
  t.ok(serialized.sentByPlugin.endAt <= Date.now())
  t.is(process.callCount, 1)
  t.is(complete.callCount, 2)
  t.is(update.callCount, 3)

  await t.exception(async () => await payment.complete(), STATE_ERRORS.INVALID_STATE(PAYMENT_STATE.COMPLETED))
  t.is(process.callCount, 1)
  t.is(complete.callCount, 3)
  t.is(update.callCount, 3)

  t.teardown(() => sinon.restore())
})

test('Payment.cancel', async t => {
  const db = new DB()
  await db.init()
  const update = sinon.replace(db, 'update', sinon.fake(db.update))

  const payment = new Payment({ ...paymentParams }, db)
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

  t.teardown(() => sinon.restore())
})

test('Payment.getCurrentPlugin', async t => {
  const db = new DB()
  await db.init()
  const payment = new Payment({ ...paymentParams }, db)
  payment.internalState.currentPlugin = 'test'

  const res = await payment.getCurrentPlugin()
  t.is(res, 'test')

  t.teardown(() => sinon.restore())
})

test('Payment.isInProgress', async t => {
  const db = new DB()
  await db.init()
  const payment = new Payment({ ...paymentParams }, db)
  await payment.init()

  t.is(payment.isInProgress(), false)
  await payment.process()
  t.is(payment.isInProgress(), true)
})

test('Payment.failCurrentPlugin', async t => {
  const db = new DB()
  await db.init()
  const payment = new Payment({
    ...paymentParams,
    id: 'test',
    pendingPlugins: paymentParams.sendingPriority
  }, db)
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

  t.teardown(() => sinon.restore())
})

test('Payment.isFinal', async t => {
  const db = new DB()
  await db.init()
  const payment = new Payment({
    ...paymentParams,
    id: 'test',
    pendingPlugins: paymentParams.sendingPriority
  }, db)
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

  t.teardown(() => sinon.restore())
})
