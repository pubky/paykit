const { test } = require('brittle')
const proxyquire = require('proxyquire')

const { DB } = require('../../src/DB')

const { paymentParams } = require('../fixtures/paymentParams')

const { Payment, PAYMENT_STATE, ERROR } = require('../../src/payments/Payment')

test('Payment.generateId', t => {
  const id = Payment.generateId()
  t.ok(id)
})

test('Payment.validatePaymentParams', t => {
  let params
  t.exception(() => Payment.validatePaymentParams(params), ERROR.PARAMS_REQUIRED)

  params = {}
  t.exception(() => Payment.validatePaymentParams(params), ERROR.ORDER_ID_REQUIRED)

  params.orderId = 'orderId'
  t.exception(() => Payment.validatePaymentParams(params), ERROR.CLIENT_ID_REQUIRED)

  params.clientOrderId = 'clientOrderId'
  t.exception(() => Payment.validatePaymentParams(params), ERROR.AMOUNT_REQUIRED)

  params.amount = '100'
  t.exception(() => Payment.validatePaymentParams(params), ERROR.TARGET_REQUIRED)

  params.id = 'id'
  t.exception(() => Payment.validatePaymentParams(params), ERROR.ALREADY_EXISTS('id'))

  delete params.id
  params.targetURL = 'targetURL'
  t.execution(() => Payment.validatePaymentParams(params))
})

test('Payment.validatePaymentConfig', t => {
  t.exception(() => Payment.validatePaymentConfig({}), ERROR.NO_SENDING_PRIORITY)
  t.execution(() => Payment.validatePaymentConfig({ sendingPriority: ['p2sh', 'lightning'] }))
})

test('Payment.validateDB', async t => {
  const db = new DB()
  t.exception(() => Payment.validateDB(), ERROR.NO_DB)
  t.exception(() => Payment.validateDB(db), ERROR.DB_NOT_READY)

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
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)

  t.is(payment.id, null)
  t.is(payment.internalState, PAYMENT_STATE.INITIAL)
  t.alike(payment.processedBy, [])
  t.is(payment.targetURL, 'slashpay://driveKey/slashpay.json')
  t.is(payment.clientOrderId, 'clientOrderId')
  t.is(payment.amount, '100')
  t.is(payment.currency, 'BTC')
  t.is(payment.denomination, 'BASE')
  t.is(payment.processingPlugin, null)
  t.is(payment.orderId, paymentParams.orderId)
  t.ok(payment.createdAt < Date.now())
  t.ok(payment.exectuteAt < Date.now())
})

test('Payment - existing', async t => {
  const db = new DB()
  await db.init()
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const params = { ...paymentParams, id: 'id' }
  t.exception(() => {
    new Payment(params, paymentConfig, db) // eslint-disable-line
  }, ERROR.ALREADY_EXISTS('id'))
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
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)

  await t.exception(async () => await payment.init(), ERROR.PAYMENT_FILE_NOT_FOUND)
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
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)

  await t.exception(async () => await payment.init(), ERROR.NO_MATCHING_PLUGINS)
})

test('Payment.init - selected priority', async t => {
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
  const db = new DB()
  await db.init()
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)
  await payment.init()
  t.alike(payment.sendingPriority, ['p2sh', 'lightning'])
})

test('Payment.serialize', async t => {
  const db = new DB()
  await db.init()
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)
  const serialized = payment.serialize()
  t.alike(serialized, {
    id: null,
    orderId: 'internalOrderId',
    clientOrderId: 'clientOrderId',
    internalState: PAYMENT_STATE.INITIAL,
    targetURL: 'slashpay://driveKey/slashpay.json',
    amount: '100',
    currency: 'BTC',
    denomination: 'BASE',
    sendingPriority: [],
    processedBy: [],
    processingPlugin: null,
    sentByPlugin: null
  })
})

test('Payment.save - iff entry is new', async t => {
  const db = new DB()
  await db.init()
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)
  await payment.save()
  const got = await db.get(payment.id)
  t.alike(got, payment.serialize())

  await t.exception(async () => await payment.save(), ERROR.ALREADY_EXISTS(payment.id))
})

test('Payment.save - overwites id if entry not found in DB', async t => {
  const db = new DB()
  await db.init()
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)
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
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)
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
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)
  await payment.save()
  const { id } = payment
  await payment.delete()

  await t.exception(async () => await payment.save(), ERROR.ALREADY_EXISTS(id))
})

test('Payment.update', async t => {
  const db = new DB()
  await db.init()
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

  const payment = new Payment(paymentParams, paymentConfig, db)
  await payment.save()
  const { id } = payment
  payment.amount = '200'
  payment.currency = 'USD'
  await payment.update()

  const got = await db.get(id)
  t.alike(got, payment.serialize())
  t.is(got.amount, '200')
  t.is(got.currency, 'USD')
})

test('Payment.process - no next plugin', async t => {
  const db = new DB()
  await db.init()
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning'] }

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
  const payment = new Payment(paymentParams, paymentConfig, db)
  await payment.save()
  await payment.init()

  t.alike(payment.sendingPriority, ['p2sh', 'lightning'])
  t.is(payment.processedBy.length, 0)
  t.is(payment.processingPlugin, null)
  t.is(payment.internalState, PAYMENT_STATE.INITIAL)

  await payment.process()

  t.alike(payment.sendingPriority, ['lightning'])
  t.alike(payment.processedBy, [])
  t.is(payment.processingPlugin, 'p2sh')
  t.is(payment.internalState, PAYMENT_STATE.IN_PROGRESS)

  await payment.process()

  t.alike(payment.sendingPriority, [])
  t.alike(payment.processedBy, ['p2sh'])
  t.is(payment.processingPlugin, 'lightning')
  t.is(payment.internalState, PAYMENT_STATE.IN_PROGRESS)

  await payment.process()

  t.alike(payment.sendingPriority, [])
  t.alike(payment.processedBy, ['p2sh', 'lightning'])
  t.is(payment.processingPlugin, null)
  t.is(payment.internalState, PAYMENT_STATE.FAILED)

  await payment.process()

  t.alike(payment.sendingPriority, [])
  t.alike(payment.processedBy, ['p2sh', 'lightning'])
  t.is(payment.processingPlugin, null)
  t.is(payment.internalState, PAYMENT_STATE.FAILED)
})

test('Payment.complete', async t => {
  const db = new DB()
  await db.init()
  const paymentConfig = { sendingPriority: ['p2sh', 'lightning', 'p2wsh'] }

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

  const payment = new Payment(paymentParams, paymentConfig, db)
  await payment.save()
  await payment.init()

  await t.exception(async () => await payment.complete(), ERROR.CAN_NOT_COMPLETE(PAYMENT_STATE.INITIAL))

  await payment.process()
  await payment.process()

  await payment.complete()

  t.is(payment.internalState, PAYMENT_STATE.COMPLETED)
  t.is(payment.processingPlugin, null)
  t.is(payment.sentByPlugin, 'lightning')
  t.alike(payment.sendingPriority, ['p2wsh'])
  t.alike(payment.processedBy, ['p2sh', 'lightning'])

  await t.exception(async () => await payment.complete(), ERROR.CAN_NOT_COMPLETE(PAYMENT_STATE.COMPLETED))
})
