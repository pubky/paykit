const { test } = require('brittle')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const { DB } = require('../../src/DB')

const { PLUGIN_STATE, PAYMENT_STATE } = require('../../src/payments/PaymentState')
const { PaymentAmount } = require('../../src/payments/PaymentAmount')

const { orderParams } = require('../fixtures/paymentParams')

const { PaymentOrder, ORDER_TYPE, ORDER_STATE, ERRORS } = require('../../src/payments/PaymentOrder')

test('PaymentOrder - new (default type)', async t => {
  const db = new DB()
  await db.init()

  const paymentOrder = new PaymentOrder(orderParams, db)
  t.is(paymentOrder.orderParams, orderParams)
  t.is(paymentOrder.db, db)
  t.is(paymentOrder.clientOrderId, orderParams.clientOrderId)
  t.is(paymentOrder.type, orderParams.type || ORDER_TYPE.ONE_TIME)
  t.alike(paymentOrder.payments, [])
  t.is(paymentOrder.frequency, null)
})

test('PaymentOrder - new (one time)', async t => {
  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.ONE_TIME }

  const paymentOrder = new PaymentOrder(params, db)
  t.is(paymentOrder.orderParams, params)
  t.is(paymentOrder.db, db)
  t.is(paymentOrder.clientOrderId, params.clientOrderId)
  t.is(paymentOrder.type, params.type || ORDER_TYPE.ONE_TIME)
  t.alike(paymentOrder.payments, [])

  t.is(paymentOrder.frequency, null)

  t.is(paymentOrder.state, ORDER_STATE.CREATED)

  t.alike(paymentOrder.amount, new PaymentAmount(params))
  t.is(paymentOrder.targetURL, params.targetURL)
  t.is(paymentOrder.memo, params.memo || '')
})

test('PaymentOrder - new (reccuring)', async t => {
  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.RECCURING }

  t.exception(() => { new PaymentOrder(params, db) }, ERRORS.NOT_IMPLEMENTED) // eslint-disable-line 
})

test('PaymentOrder.init', async t => {
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () {
          this.ready = false
        }

        async init () { this.ready = true }
        async read () {
          return {
            paymentEndpoints: {
              lightning: '/lightning/slashpay.json',
              p2sh: '/p2sh/slashpay.json',
              p2wsh: '/p2wsh/slashpay.json'
            }
          }
        }
      }
    }
  })

  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', { './Payment': { Payment } })

  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.ONE_TIME }

  const paymentOrder = new PaymentOrder(params, db)
  t.absent(paymentOrder.id)
  await paymentOrder.init()

  t.ok(paymentOrder.id)
  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)

  const got = await db.get(paymentOrder.id)
  t.alike(got, {
    id: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    type: 'one-time',
    state: ORDER_STATE.INITIALIZED,
    frequency: null,
    targetURL: orderParams.targetURL,
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
    targetURL: orderParams.targetURL,
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE',
    internalState: PAYMENT_STATE.INITIAL,
    pendingPlugins: orderParams.sendingPriority,
    triedPlugins: [],
    currentPlugin: {},
    sentByPlugin: {}
  })
})

test('PaymentOrder.serialize', async t => {
  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.ONE_TIME }

  const paymentOrder = new PaymentOrder(params, db)
  const serialized = paymentOrder.serialize()
  t.alike(serialized, {
    id: null,
    clientOrderId: params.clientOrderId,
    type: params.type,
    frequency: null,
    amount: params.amount,
    currency: 'BTC',
    denomination: 'BASE',
    targetURL: params.targetURL,
    memo: '',
    sendingPriority: params.sendingPriority,
    state: ORDER_STATE.CREATED
  })
})

test('PaymentOrder.save', async t => {
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () {
          this.ready = false
        }

        async init () { this.ready = true }
        async read () {
          return {
            paymentEndpoints: {
              lightning: '/lightning/slashpay.json',
              p2sh: '/p2sh/slashpay.json',
              p2wsh: '/p2wsh/slashpay.json'
            }
          }
        }
      }
    }
  })

  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', { './Payment': { Payment } })

  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.ONE_TIME }

  const paymentOrder = new PaymentOrder(params, db)
  await paymentOrder.init()

  t.ok(paymentOrder.id)
  const gotOrder = await db.get(paymentOrder.id)
  t.alike(gotOrder, {
    id: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    type: 'one-time',
    state: ORDER_STATE.INITIALIZED,
    frequency: null,
    targetURL: orderParams.targetURL,
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE'
  })

  const gotPayment = await db.get(paymentOrder.payments[0].id)
  t.alike(gotPayment, {
    id: 'totally-random-id',
    orderId: paymentOrder.id,
    clientOrderId: orderParams.clientOrderId,
    targetURL: orderParams.targetURL,
    memo: '',
    sendingPriority: orderParams.sendingPriority,
    amount: orderParams.amount,
    currency: 'BTC',
    denomination: 'BASE',
    internalState: PAYMENT_STATE.INITIAL,
    pendingPlugins: orderParams.sendingPriority,
    triedPlugins: [],
    currentPlugin: {},
    sentByPlugin: {}
  })
})

test('PaymentOrder.update', async t => {
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () {
          this.ready = false
        }

        async init () { this.ready = true }
        async read () {
          return {
            paymentEndpoints: {
              lightning: '/lightning/slashpay.json',
              p2sh: '/p2sh/slashpay.json',
              p2wsh: '/p2wsh/slashpay.json'
            }
          }
        }
      }
    }
  })

  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', { './Payment': { Payment } })

  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.ONE_TIME }

  const paymentOrder = new PaymentOrder(params, db)
  await paymentOrder.init()
  let got

  t.ok(paymentOrder.id)
  got = await db.get(paymentOrder.id)
  t.is(got.amount, '100')

  paymentOrder.amount = new PaymentAmount({ amount: '101' })
  await paymentOrder.update()

  got = await db.get(paymentOrder.id)

  t.alike(got, paymentOrder.serialize())
  t.is(got.amount, '101')
})

test('PaymentOrder.complete', async t => {
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () {
          this.ready = false
        }

        async init () { this.ready = true }
        async read () {
          return {
            paymentEndpoints: {
              lightning: '/lightning/slashpay.json',
              p2sh: '/p2sh/slashpay.json',
              p2wsh: '/p2wsh/slashpay.json'
            }
          }
        }
      }
    }
  })

  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', { './Payment': { Payment } })

  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.ONE_TIME }

  const paymentOrder = new PaymentOrder(params, db)
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
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () {
          this.ready = false
        }

        async init () { this.ready = true }
        async read () {
          return {
            paymentEndpoints: {
              lightning: '/lightning/slashpay.json',
              p2sh: '/p2sh/slashpay.json',
              p2wsh: '/p2wsh/slashpay.json'
            }
          }
        }
      }
    }
  })

  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', { './Payment': { Payment } })

  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.ONE_TIME }

  const paymentOrder = new PaymentOrder(params, db)
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
  t.is(serialized.targetURL, orderParams.targetURL)
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
  t.is(serialized.targetURL, orderParams.targetURL)
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
  t.is(serialized.sentByPlugin.name, 'lightning')
  t.is(serialized.sentByPlugin.state, PLUGIN_STATE.SUCCESS)
  t.ok(serialized.sentByPlugin.startAt <= Date.now())
  t.ok(serialized.sentByPlugin.endAt <= Date.now())
})

test('PaymentOrder.cancel', async t => {
  const paymentInstanceStub = {
    init: sinon.stub().resolves(),
    save: sinon.stub().resolves(),
    cancel: sinon.stub().resolves()
  }
  const paymentClassStub = sinon.stub().returns(paymentInstanceStub)

  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', {
    './Payment': {
      Payment: paymentClassStub
    }
  })

  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.ONE_TIME }

  const paymentOrder = new PaymentOrder(params, db)
  await paymentOrder.init()

  t.ok(paymentOrder.id)
  t.is(paymentInstanceStub.init.callCount, 1)
  t.is(paymentInstanceStub.save.callCount, 1)

  await paymentOrder.cancel()

  t.is(paymentOrder.state, ORDER_STATE.CANCELLED)
  t.is(paymentInstanceStub.cancel.callCount, 1)
})

test('PaymentOrder.find', async t => {
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () {
          this.ready = false
        }

        async init () { this.ready = true }
        async read () {
          return {
            paymentEndpoints: {
              lightning: '/lightning/slashpay.json',
              p2sh: '/p2sh/slashpay.json',
              p2wsh: '/p2wsh/slashpay.json'
            }
          }
        }
      }
    }
  })

  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', { './Payment': { Payment } })
  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.ONE_TIME }

  const paymentOrder = new PaymentOrder(params, db)
  await paymentOrder.init()
  const id = paymentOrder.id

  const got = await PaymentOrder.find(id, db)
  t.alike(got.serialize(), paymentOrder.serialize())
})
