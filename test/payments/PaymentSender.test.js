const sinon = require('sinon')
const proxyquire = require('proxyquire')
const { test } = require('brittle')

const { DB } = require('../../src/DB')

const { PluginManager } = require('../../src/plugins/PluginManager')
const { pluginConfig } = require('../fixtures/config.js')

const { orderParams } = require('../fixtures/paymentParams')

const { PAYMENT_STATE } = require('../../src/payments/Payment')

test('PaymentSender - constructor', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

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

  const params = { ...orderParams }

  const paymentOrder = new PaymentOrder(params, db)
  await paymentOrder.init()

  const { PaymentSender } = proxyquire('../../src/payments/PaymentSender', {
    './PaymentOrder': { PaymentOrder }
  })

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, db, pluginManager, () => {})

  t.alike(paymentSender.db, db)
  t.alike(paymentSender.paymentOrder, paymentOrder)
  t.alike(paymentSender.notificationCallback.toString(), '() => {}')

  t.teardown(() => {
    sinon.restore()
    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender - submit', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

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
              lightning: '/lightning/slashpay.json'
            }
          }
        }
      }
    }
  })

  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', {
    './Payment': { Payment }
  })

  const db = new DB()
  await db.init()

  const params = { ...orderParams }

  const paymentOrder = new PaymentOrder(params, db)
  await paymentOrder.init()
  await paymentOrder.save()
  const processStub = sinon.replace(paymentOrder, 'process', sinon.fake(paymentOrder.process))

  const { PaymentSender } = proxyquire('../../src/payments/PaymentSender', {
    './PaymentOrder': { PaymentOrder }
  })

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, db, pluginManager, () => {})
  await paymentSender.submit()

  t.is(Object.keys(pluginManager.plugins).length, 1)
  t.is(pluginManager.plugins.p2sh.plugin.pay.callCount, 1)
  t.alike(pluginManager.plugins.p2sh.plugin.pay.getCall(0).args, [paymentOrder.payments[0].serialize(), paymentSender.stateUpdateCallback])
  t.is(processStub.callCount, 1)

  t.teardown(() => {
    sinon.restore()
    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender - stateUpdateCallback (success)', async t => {
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
              lightning: '/lightning/slashpay.json'
            }
          }
        }
      }
    }
  })

  const { PaymentOrder } = proxyquire('../../src/payments/PaymentOrder', {
    './Payment': { Payment }
  })

  const db = new DB()
  await db.init()

  const params = { ...orderParams }

  const paymentOrder = new PaymentOrder(params, db)
  await paymentOrder.init()
  await paymentOrder.save()

  const { PaymentSender } = proxyquire('../../src/payments/PaymentSender', {
    './PaymentOrder': { PaymentOrder }
  })

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, db, pluginManager, () => {})

  const payment = paymentOrder.payments[0]
  const paymentUpdate = {
    id: payment.id,
    pluginState: 'success'
  }

  await paymentSender.submit()
  await paymentSender.stateUpdateCallback(paymentUpdate)

  const got = await db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.COMPLETED)
})

test('PaymentSender - stateUpdateCallback (success)', async t => {
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

  const db = new DB()
  await db.init()

  const params = { ...orderParams }

  const paymentOrder = new PaymentOrder({
    ...params,
    sendingPriority: ['p2sh', 'p2tr']
  }, db)
  await paymentOrder.init()
  await paymentOrder.save()

  const { PaymentSender } = proxyquire('../../src/payments/PaymentSender', {
    './PaymentOrder': { PaymentOrder }
  })

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, db, pluginManager, () => {})

  const payment = paymentOrder.payments[0]
  let paymentUpdate = {
    id: payment.id,
    pluginState: 'failed'
  }

  await paymentSender.submit()
  await paymentSender.stateUpdateCallback(paymentUpdate)

  let got = await db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.IN_PROGRESS)

  paymentUpdate = {
    id: payment.id,
    pluginState: 'success'
  }

  await paymentSender.stateUpdateCallback(paymentUpdate)
  got = await db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.COMPLETED)
})
