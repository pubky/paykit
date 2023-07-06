const sinon = require('sinon')
const { test } = require('brittle')
const createTestnet = require('@hyperswarm/testnet')

const { DB } = require('../../src/DB')

const { SlashtagsConnector, SLASHPAY_PATH } = require('../../src/slashtags')
const { PluginManager } = require('../../src/plugins/PluginManager')
const { pluginConfig } = require('../fixtures/config.js')

const { orderParams } = require('../fixtures/paymentParams')

const { PAYMENT_STATE } = require('../../src/payments/Payment')
const { PaymentSender, PLUGIN_STATES } = require('../../src/payments/PaymentSender')
const { PaymentOrder, ORDER_STATE, ERRORS: ORDER_ERRORS } = require('../../src/payments/PaymentOrder')

const { getOneTimePaymentOrderEntities, sleep } = require('../helpers')

test('PaymentSender.constructor', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const { paymentOrder, sender, receiver } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)
  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})

  t.alike(paymentSender.paymentOrder, paymentOrder)
  t.alike(paymentSender.entryPointForPlugin.toString(), '() => {}')

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()

    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender.submit', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const { paymentOrder, sender, receiver } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const serialized = paymentOrder.payments[0].serialize()
  const pluginName = 'p2sh'
  const payload = {
    id: serialized.id,
    orderId: serialized.orderId,
    memo: serialized.memo,
    amount: serialized.amount,
    currency: serialized.currency,
    denomination: serialized.denomination,
    counterpartyURL: `${serialized.counterpartyURL}/public/slashpay/${pluginName}/slashpay.json`
  }

  t.is(Object.keys(pluginManager.plugins).length, 1)
  t.is(pluginManager.plugins.p2sh.plugin.pay.callCount, 1)
  t.alike(pluginManager.plugins.p2sh.plugin.pay.getCall(0).args, [payload, paymentSender.entryPointForPlugin])

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()

    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender.stateUpdateCallback (success)', async t => {
  const { paymentOrder, sender, receiver } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const payment = paymentOrder.payments[0]
  const paymentUpdate = {
    id: payment.id,
    pluginState: PLUGIN_STATES.SUCCESS
  }
  await paymentSender.stateUpdateCallback(paymentUpdate)

  const got = await paymentOrder.db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.COMPLETED)

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()
  })
})

test('PaymentSender.stateUpdateCallback (failure, success)', async t => {
  const { paymentOrder, sender, receiver } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const payment = paymentOrder.payments[0]
  let paymentUpdate = {
    id: payment.id,
    pluginState: PLUGIN_STATES.FAILED
  }

  await paymentSender.stateUpdateCallback(paymentUpdate)

  let got = await paymentOrder.db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.IN_PROGRESS)

  paymentUpdate = {
    id: payment.id,
    pluginState: PLUGIN_STATES.SUCCESS
  }

  await paymentSender.stateUpdateCallback(paymentUpdate)
  got = await paymentOrder.db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.COMPLETED)

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()
  })
})

test('PaymentSender.stateUpdateCallback (intermediate state)', async t => {
  const { paymentOrder, sender, receiver } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const entryPointForPlugin = sinon.spy()
  const paymentSender = new PaymentSender(paymentOrder, pluginManager, entryPointForPlugin)

  await paymentSender.submit()

  const payment = paymentOrder.payments[0]
  const paymentUpdate = {
    id: payment.id,
    pluginState: 'intermediate'
  }
  await paymentSender.stateUpdateCallback(paymentUpdate)

  t.is(entryPointForPlugin.callCount, 1)

  const got = await paymentOrder.db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.is(got.currentPlugin.name, 'p2sh')
  t.alike(got.pendingPlugins, ['p2tr'])
  t.alike(got.completedByPlugin, {})

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()
  })
})

test('PaymentSender.stateUpdateCallback (failure, failure)', async t => {
  const { paymentOrder, sender, receiver } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const payment = paymentOrder.payments[0]
  let paymentUpdate = {
    id: payment.id,
    pluginState: PLUGIN_STATES.FAILED
  }

  await paymentSender.stateUpdateCallback(paymentUpdate)

  let got = await paymentOrder.db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.IN_PROGRESS)

  paymentUpdate = {
    id: payment.id,
    pluginState: PLUGIN_STATES.FAILED
  }

  await paymentSender.stateUpdateCallback(paymentUpdate)
  got = await paymentOrder.db.get(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.FAILED)
  t.is(got.triedPlugins.length, 2)
  t.alike(got.pendingPlugins, [])
  t.alike(got.completedByPlugin, {})

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()
  })
})

test('PaymentSender.updatePayment', async t => {
  const { paymentOrder, sender, receiver } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const payment = paymentSender.paymentOrder.getPaymentInProgress()
  const { plugin } = pluginManager.plugins[payment.getCurrentPlugin().name]

  await paymentSender.updatePayment({ foo: 'bar' })

  t.is(plugin.updatePayment.callCount, 1)

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()
  })
})

test('PaymentSender.getCurrentPlugin', async t => {
  const { paymentOrder, sender, receiver } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const payment = paymentSender.paymentOrder.getPaymentInProgress()

  const plugin = await paymentSender.getCurrentPlugin(payment)

  t.ok(plugin.active)
  t.ok(plugin.plugin)
  t.ok(plugin.manifest)

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()
  })
})

test('PaymentSender - recurring payment all success', async t => {
  const db = new DB()
  await db.init()

  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const testnet = await createTestnet(3, t.teardown)
  const receiver = new SlashtagsConnector(testnet)
  await receiver.init()
  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: {
      p2sh: '/public/p2sh.json',
      p2tr: '/public/p2tr.json'
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

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    // TODO: remove when id is generated
    paymentOrder.payments[i].id = paymentOrder.payments[i].id + i
  }

  const pluginManager = new PluginManager(pluginConfig)

  const entryPointForPlugin = sinon.spy()
  const paymentSender = new PaymentSender(paymentOrder, pluginManager, entryPointForPlugin)

  await paymentSender.submit()

  const submitSpy = sinon.spy(paymentSender, 'submit')

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
    const payment = paymentOrder.payments[i]
    const paymentUpdate = {
      id: payment.id,
      pluginState: PLUGIN_STATES.SUCCESS
    }
    await paymentSender.stateUpdateCallback(paymentUpdate)

    await sleep(1)
  }

  t.is(submitSpy.callCount, paymentOrder.payments.length - 1) // -1 for last call
  t.is(paymentSender.paymentOrder.state, ORDER_STATE.COMPLETED)

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()

    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender - recurring payment intermediate failure', async t => {
  const db = new DB()
  await db.init()

  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const testnet = await createTestnet(3, t.teardown)
  const receiver = new SlashtagsConnector(testnet)
  await receiver.init()
  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: {
      p2sh: '/public/p2sh.json',
      p2tr: '/public/p2tr.json'
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

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    // TODO: remove when id is generated
    paymentOrder.payments[i].id = paymentOrder.payments[i].id + i
  }

  const pluginManager = new PluginManager(pluginConfig)

  const entryPointForPlugin = sinon.spy()
  const paymentSender = new PaymentSender(paymentOrder, pluginManager, entryPointForPlugin)

  await paymentSender.submit()

  const submitSpy = sinon.spy(paymentSender, 'submit')
  const stateUpdateSpy = sinon.spy(paymentSender, 'stateUpdateCallback')

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    if (i === paymentOrder.payments.length - 1) {
      t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
      await paymentSender.stateUpdateCallback({
        id: paymentOrder.payments[i].id,
        pluginState: PLUGIN_STATES.FAILED
      })
      await sleep(1)

      t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
      await paymentSender.stateUpdateCallback({
        id: paymentOrder.payments[i].id,
        pluginState: PLUGIN_STATES.SUCCESS
      })
      await sleep(1)

      break
    }
    t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
    await paymentSender.stateUpdateCallback({
      id: paymentOrder.payments[i].id,
      pluginState: PLUGIN_STATES.SUCCESS
    })
    await sleep(1)
  }

  t.is(submitSpy.callCount, stateUpdateSpy.callCount - 1) // -1 for last call
  t.is(paymentSender.paymentOrder.state, ORDER_STATE.COMPLETED)

  await t.exception(async () => { await paymentSender.submit() }, ORDER_ERRORS.CANNONT_PROCESS_ORDER)

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()

    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender - recurring payment completely failed intermediate payment', async t => {
  const db = new DB()
  await db.init()

  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const testnet = await createTestnet(3, t.teardown)
  const receiver = new SlashtagsConnector(testnet)
  await receiver.init()
  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: {
      p2sh: '/public/p2sh.json',
      p2tr: '/public/p2tr.json'
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

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    // TODO: remove when id is generated
    paymentOrder.payments[i].id = paymentOrder.payments[i].id + i
  }

  const pluginManager = new PluginManager(pluginConfig)

  const entryPointForPlugin = sinon.spy()
  const paymentSender = new PaymentSender(paymentOrder, pluginManager, entryPointForPlugin)

  await paymentSender.submit()

  const submitSpy = sinon.spy(paymentSender, 'submit')
  const stateUpdateSpy = sinon.spy(paymentSender, 'stateUpdateCallback')

  for (let i = 0; i < paymentOrder.payments.length; i++) {
    if (i === paymentOrder.payments.length - 1) {
      t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
      await paymentSender.stateUpdateCallback({
        id: paymentOrder.payments[i].id,
        pluginState: PLUGIN_STATES.FAILED
      })
      await sleep(1)

      t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
      await paymentSender.stateUpdateCallback({
        id: paymentOrder.payments[i].id,
        pluginState: PLUGIN_STATES.FAILED
      })
      await sleep(1)

      break
    }
    t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
    await paymentSender.stateUpdateCallback({
      id: paymentOrder.payments[i].id,
      pluginState: PLUGIN_STATES.SUCCESS
    })
    await sleep(1)
  }

  const outstandingPayment = await paymentSender.paymentOrder.getFirstOutstandingPayment()
  t.absent(outstandingPayment)

  const paymentInProgress = await paymentSender.paymentOrder.getPaymentInProgress()
  t.absent(paymentInProgress)

  t.is(submitSpy.callCount, stateUpdateSpy.callCount)

  // NOTE: even though there no outstanding payments, the order is still processing
  t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
  await t.exception(async () => { await paymentSender.submit() }, ORDER_ERRORS.CANNONT_PROCESS_ORDER)
  // XXX: payment order with failed payments needs to be manually completed
  await paymentSender.paymentOrder.complete()
  t.is(paymentSender.paymentOrder.state, ORDER_STATE.COMPLETED)

  t.teardown(async () => {
    await sender.close()
    await receiver.close()

    sinon.restore()

    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})
