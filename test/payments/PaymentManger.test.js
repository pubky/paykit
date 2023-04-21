const sinon = require('sinon')
const proxyquire = require('proxyquire')

const { skip, test } = require('brittle')

const { DB } = require('../../src/DB')

const { config } = require('../fixtures/config')
const { paymentParams } = require('../fixtures/paymentParams')

const { PaymentManager } = require('../../src/payments/PaymentManager')
const { PluginManager } = require('../../src/pluginManager')

test('PaymentManager: constructor', async t => {
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)

  t.alike(paymentManager.db, db)
  t.alike(paymentManager.config, config)
  t.is(paymentManager.ready, false)
})

test('PaymentManager: init', async t => {
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  const init = sinon.stub(db, 'init').resolves()

  await paymentManager.init()

  t.is(paymentManager.ready, true)
  t.is(init.calledOnce, true)

  t.teardown(() => {
    init.restore()
  })
})

test('PaymentManager: createPaymentOrder', async t => {
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () { this.ready = false }

        async init () { this.ready = true }
        async read () {
          return {
            paymentEndpoints: {
              p2sh: '/p2sh/slashpay.json',
              p2tr: '/p2tr/slashpay.json',
            }
          }
        }
      }
    }
  })
  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', {
    './Payment': { Payment }
  })

  const { PaymentManager } = proxyquire('../../src/payments/PaymentManager', {
    './PaymentOrder': { PaymentOrder }
  })

  const db = new DB()

  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const paymentOrder = await paymentManager.createPaymentOrder(paymentParams)

  const got = await db.get(paymentOrder.id)
  t.alike(got, paymentOrder)
})

test('PaymentManager: sendPayment', async t => {
  const { Payment } = proxyquire('../../src/payments/Payment', {
    '../SlashtagsAccessObject': {
      SlashtagsAccessObject: class SlashtagsAccessObject {
        constructor () { this.ready = false }

        async init () { this.ready = true }
        async read () {
          return {
            paymentEndpoints: {
              p2sh: '/p2sh/slashpay.json',
              p2tr: '/p2tr/slashpay.json',
            }
          }
        }
      }
    }
  })
  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', {
    './Payment': { Payment }
  })

  const p2shStub = require('../fixtures/p2sh/main.js')
  const { PaymentManager } = proxyquire('../../src/payments/PaymentManager', {
    './PaymentOrder': { PaymentOrder },
    '../PluginManager': { PluginManager }
  })
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const payment = await paymentManager.createPaymentOrder(paymentParams)

  await paymentManager.sendPayment(payment.id)

  t.ok(p2shStub.init.calledOnce)
  t.ok(p2shStub.init.getCall(0).returnValue.pay.calledOnce)
})

skip('PaymentManager: receivePayments', async t => {
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()
})

skip('PaymentManager: entryPointForPlugin ask client', async t => {
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const askClient = sinon.stub(paymentManager, 'askClient').resolves()

  paymentManager.entryPointForPlugin({ state: 'waitingForClient' })

  t.is(askClient.calledOnce, true)
  t.is(askClient.calledWith({ state: 'waitingForClient' }), true)

  t.teardown(() => askClient.restore())
})

skip('PaymentManager: entryPointForPlugin createIncomingPayment', async t => {
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const createIncomingPayment = sinon.stub(db, 'createIncomingPayment').resolves()

  paymentManager.entryPointForPlugin({ state: 'newPayment' })

  t.is(createIncomingPayment.calledOnce, true)
  t.is(createIncomingPayment.calledWith({ state: 'newPayment' }), true)

  t.teardown(() => createIncomingPayment.restore())
})

skip('PaymentManager: entryPointForUser', async t => {
  const db = new DB()
})
