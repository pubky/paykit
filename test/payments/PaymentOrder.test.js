const { test } = require('brittle')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const { DB } = require('../../src/DB')

const { PAYMENT_STATE } = require('../../src/payments/Payment')
const { PaymentAmount } = require('../../src/payments/PaymentAmount')

const { orderParams } = require('../fixtures/paymentParams')

const { PaymentOrder, ORDER_TYPE, ORDER_STATE, ERRORS } = require('../../src/payments/PaymentOrder')

test('PaymentOrder - contructor (default type)', async t => {
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

test('PaymentOrder - contructor (one time)', async t => {
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

test('PaymentOrder - contructor (reccuring)', async t => {
  const db = new DB()
  await db.init()

  const params = { ...orderParams, type: ORDER_TYPE.RECCURING }

  t.exception(() => { new PaymentOrder(params, db) }, ERRORS.NOT_IMPLEMENTED) // eslint-disable-line 
})

test('PaymentOrder - init', async t => {
  const paymentInstanceStub = {
    init: sinon.stub().resolves(),
    save: sinon.stub().resolves()
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
  t.absent(paymentOrder.id)
  await paymentOrder.init()

  t.is(paymentClassStub.callCount, 1)
  t.alike(paymentClassStub.args[0][0], { ...params, orderId: paymentOrder.id })
  t.alike(paymentClassStub.args[0][1], db)
  t.is(paymentInstanceStub.init.callCount, 1)
  t.alike(paymentOrder.payments, [paymentInstanceStub])
  t.ok(paymentOrder.id)

  t.is(paymentOrder.state, ORDER_STATE.INITIALIZED)
})

test('serialize', async t => {
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

test('PaymentOrder - save', async t => {
  const paymentInstanceStub = {
    init: sinon.stub().resolves(),
    save: sinon.stub().resolves()
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
  await paymentOrder.save()

  t.ok(paymentOrder.id)
  t.is(paymentInstanceStub.init.callCount, 1)
  t.is(paymentInstanceStub.save.callCount, 1)
})

test('PaymentOrder - update', async t => {
  const paymentInstanceStub = {
    init: sinon.stub().resolves(),
    save: sinon.stub().resolves()
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
  await paymentOrder.save()

  t.ok(paymentOrder.id)
  t.is(paymentInstanceStub.init.callCount, 1)
  t.is(paymentInstanceStub.save.callCount, 1)

  paymentOrder.state = ORDER_STATE.CANCELLED
  await paymentOrder.update()

  const got = await db.get(paymentOrder.id)

  t.alike(got, paymentOrder.serialize())
  t.is(paymentOrder.state, ORDER_STATE.CANCELLED)
})

test('PaymentOrder - complete', async t => {
  const paymentInstanceStub = {
    init: sinon.stub().resolves(),
    save: sinon.stub().resolves()
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
  await paymentOrder.save()

  t.ok(paymentOrder.id)
  t.is(paymentInstanceStub.init.callCount, 1)
  t.is(paymentInstanceStub.save.callCount, 1)

  paymentOrder.state = ORDER_STATE.CANCELLED
  await paymentOrder.update()

  await t.exception(async () => { await paymentOrder.complete() }, ERRORS.ORDER_CANCELLED)

  paymentOrder.state = ORDER_STATE.PROCESSING
  await paymentOrder.update()

  paymentOrder.payments[0].state = PAYMENT_STATE.COMPLETED

  await paymentOrder.complete()
  t.is(paymentOrder.state, ORDER_STATE.COMPLETED)
})

test('PaymentOrder - cancel', async t => {
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
  await paymentOrder.save()

  t.ok(paymentOrder.id)
  t.is(paymentInstanceStub.init.callCount, 1)
  t.is(paymentInstanceStub.save.callCount, 1)

  await paymentOrder.cancel()

  t.is(paymentOrder.state, ORDER_STATE.CANCELLED)
  t.is(paymentInstanceStub.cancel.callCount, 1)
})

test('PaymentOrder - process', async t => {
  const paymentInstanceStub = {
    init: sinon.stub().resolves(),
    save: sinon.stub().resolves(),
    process: sinon.stub().resolves('payment')
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
  await paymentOrder.save()

  t.ok(paymentOrder.id)
  t.is(paymentInstanceStub.init.callCount, 1)
  t.is(paymentInstanceStub.save.callCount, 1)

  const payment = await paymentOrder.process()

  t.is(paymentOrder.state, ORDER_STATE.PROCESSING)
  t.is(paymentInstanceStub.process.callCount, 1)
  t.is(payment, 'payment')
})

test('PaymentOrder - find', async t => {
  const paymentInstanceStub = {
    init: sinon.stub().resolves(),
    save: sinon.stub().resolves()
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
  const id = paymentOrder.id
  await paymentOrder.save()

  const got = await PaymentOrder.find(id, db)
  t.alike(got.serialize(), paymentOrder.serialize())
})
