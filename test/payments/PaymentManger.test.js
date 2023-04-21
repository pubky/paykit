const sinon = require('sinon')
const proxyquire = require('proxyquire')

const { skip, test } = require('brittle')

const { DB } = require('../../src/DB')
const { SlashtagsAccessObject } = require('../../src/SlashtagsAccessObject')

const { config } = require('../fixtures/config')
const { paymentParams } = require('../fixtures/paymentParams')

const { PaymentManager } = require('../../src/payments/PaymentManager')
const { Payment } = require('../../src/payments/Payment')
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
              p2tr: '/p2tr/slashpay.json'
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
              p2tr: '/p2tr/slashpay.json'
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

test('PaymentManager: receivePayments', async t => {
  const validConfig = {...config}
  validConfig.plugins = {
    p2sh: config.plugins.p2sh,
    p2tr: config.plugins.p2tr
  }

  const db = new DB()
  const paymentManager = new PaymentManager(validConfig, db)
  await paymentManager.init()
  const url = await paymentManager.receivePayments()

  // FIXME: hardcoded in SlashtagsAccessObject for now
  t.is(url, 'randomDriveKey')
})

test('PaymentManager: entryPointForPlugin new payment', async t => {
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  await paymentManager.entryPointForPlugin({
    pluginState: 'newPayment',
    pluginName: 'p2sh',

    orderId: 'testOrderId',
    clientOrderId: 'testClientOrderId',
    amount: '1000',
    targetURL: 'sourgURL',
  })

  // FIXME: hardcoded id
  const payment = await db.get('totally-random-id')
  t.alike(payment, {
    id: 'totally-random-id',
    orderId: 'testOrderId',
    clientOrderId: 'testClientOrderId',
    internalState: 'initial',
    targetURL: 'sourgURL',
    memo: '',
    amount: '1000',
    currency: 'BTC',
    denomination: 'BASE',
    sendingPriority: [],
    processedBy: [],
    processingPlugin: null,
    sentByPlugin: null
  })
})

test('PaymentManager: entryPointForPlugin waiting for client', async t => {
  const db = new DB()
  await db.init()

  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const stub = sinon.replace(paymentManager, 'userNotificationEndpoint', sinon.fake())

  await paymentManager.entryPointForPlugin({
    pluginState: 'waitingForClient',
  })

  t.is(stub.calledOnce, true)
})

test('PaymentManager: entryPointForUser', async t => {
  const updatePaymentStub = sinon.stub().resolves()

  const { PaymentManager } = proxyquire('../../src/payments/PaymentManager', {
    '../pluginManager': { PluginManager: class PluginManager {
      constructor () { }
      async loadPlugin () {
        return {
          plugin: {
            async updatePayment (args) { return await updatePaymentStub(args) }
          }
        }
      }
      }
    }
  })
  const db = new DB()
  const paymentManager = new PaymentManager(config, db)
  await paymentManager.init()

  const data = { pluginName: 'p2sh', foo: 'bar' }
  await paymentManager.entryPointForUser(data)

  const p2shStub = require('../fixtures/p2sh/main.js')

  t.ok(updatePaymentStub.calledOnce)
  t.alike(updatePaymentStub.getCall(0).args[0], data)
})
