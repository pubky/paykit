const sinon = require('sinon')
const { test } = require('brittle')
const { Relay } = require('@synonymdev/web-relay')

const { DB } = require('../../src/DB')

const { TransportConnector, SLASHPAY_PATH } = require('../../src/transport')
const { PluginManager } = require('../../src/plugins/PluginManager')
const { pluginConfig } = require('../fixtures/config.js')

const { orderParams } = require('../fixtures/paymentParams')

const { PAYMENT_STATE } = require('../../src/payments/PaymentObject')
const { PaymentSender, PLUGIN_STATES } = require('../../src/payments/PaymentSender')
const { PaymentOrder, ORDER_STATE, ERRORS: ORDER_ERRORS } = require('../../src/payments/PaymentOrder')

const { getOneTimePaymentOrderEntities, dropTables, tmpdir } = require('../helpers')

test('PaymentSender.constructor', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)
  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})

  t.alike(paymentSender.paymentOrder, paymentOrder)
  t.alike(paymentSender.entryPointForPlugin.toString(), '() => {}')

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)

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

  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const serialized = paymentOrder.payments[0].serialize()

  t.is(Object.keys(pluginManager.plugins).length, 1)
  t.is(pluginManager.plugins.p2sh.plugin.pay.callCount, 1)

  const { target, payload, notificationCallback } = pluginManager.plugins.p2sh.plugin.pay.getCall(0).args[0]

  t.alike(payload, {
    id: serialized.id,
    orderId: serialized.orderId,
    memo: serialized.memo,
    amount: serialized.amount,
    currency: serialized.currency,
    denomination: serialized.denomination
  })

  t.is(typeof notificationCallback, 'function')
  t.is(typeof target.p2sh, 'string')

  t.teardown(async () => {
    await dropTables(db)
    relay.close()

    sinon.restore()

    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender.stateUpdateCallback (success)', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t, true)
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

  const got = await paymentOrder.db.getPayment(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.COMPLETED)

  t.teardown(async () => {
    await dropTables(db)

    sinon.restore()
    relay.close()
  })
})

test('PaymentSender.stateUpdateCallback (failure, success)', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t, true)
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

  let got = await paymentOrder.db.getPayment(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.IN_PROGRESS)

  paymentUpdate = {
    id: payment.id,
    pluginState: PLUGIN_STATES.SUCCESS
  }

  await paymentSender.stateUpdateCallback(paymentUpdate)
  got = await paymentOrder.db.getPayment(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.COMPLETED)

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)

    sinon.restore()
  })
})

test('PaymentSender.stateUpdateCallback (intermediate state)', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t, true)
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

  const got = await paymentOrder.db.getPayment(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.IN_PROGRESS)
  t.is(got.currentPlugin.name, 'p2sh')
  t.alike(got.pendingPlugins, ['p2tr'])
  t.alike(got.completedByPlugin, {})

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)

    sinon.restore()
  })
})

test('PaymentSender.stateUpdateCallback (failure, failure)', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t, true)
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

  let got = await paymentOrder.db.getPayment(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.IN_PROGRESS)

  paymentUpdate = {
    id: payment.id,
    pluginState: PLUGIN_STATES.FAILED
  }

  await paymentSender.stateUpdateCallback(paymentUpdate)
  got = await paymentOrder.db.getPayment(payment.id)

  t.is(got.id, payment.id)
  t.is(got.internalState, PAYMENT_STATE.FAILED)
  t.is(got.triedPlugins.length, 2)
  t.alike(got.pendingPlugins, [])
  t.alike(got.completedByPlugin, {})

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)

    sinon.restore()
  })
})

test('PaymentSender.updatePayment', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t, true)
  await paymentOrder.init()

  const pluginManager = new PluginManager(pluginConfig)

  const paymentSender = new PaymentSender(paymentOrder, pluginManager, () => {})
  await paymentSender.submit()

  const payment = paymentSender.paymentOrder.getPaymentInProgress()
  const { plugin } = pluginManager.plugins[payment.getCurrentPlugin().name]

  await paymentSender.updatePayment({ foo: 'bar' })

  t.is(plugin.updatePayment.callCount, 1)

  t.teardown(async () => {
    await dropTables(db)

    sinon.restore()
    relay.close()
  })
})

test('PaymentSender.getCurrentPlugin', async t => {
  const { paymentOrder, db, relay } = await getOneTimePaymentOrderEntities(t, true)
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
    await dropTables(db)

    sinon.restore()
    relay.close()
  })
})

test('PaymentSender - recurring payment all success', async t => {
  const db = new DB({ name: 'test', path: './test_db' })
  await db.init()
  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const receiver = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  const p2sh = await receiver.create('public/slashpay/p2sh.json', { p2sh: '342ftSRCvFHfCeFFBuz4xwbeqnDw6BGUey' }, { awaitRelaySync: true })
  const p2tr = await receiver.create('public/slashpay/p2tr.json', { p2tr: 'bc1pxwww0ct9ue7e8tdnlmug5m2tamfn7q06sahstg39ys4c9f3340qqxrdu9k' }, { awaitRelaySync: true })
  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: { p2sh, p2tr }
  }, { awaitRelaySync: true })

  const sender = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  const params = {
    ...orderParams,
    frequency: 1, // 1 ms
    lastPaymentAt: Date.now() + 3,
    counterpartyURL: await receiver.getUrl(),
    amount: '1'
  }

  const paymentOrder = new PaymentOrder(params, db, sender)
  await paymentOrder.init()

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
  }

  t.is(submitSpy.callCount, paymentOrder.payments.length - 1) // -1 for last call
  t.is(paymentSender.paymentOrder.state, ORDER_STATE.COMPLETED)

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)

    sinon.restore()

    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender - recurring payment intermediate failure', async t => {
  const db = new DB({ name: 'test', path: './test_db' })
  await db.init()

  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const receiver = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  const p2sh = await receiver.create('public/slashpay/p2sh.json', { p2sh: '342ftSRCvFHfCeFFBuz4xwbeqnDw6BGUey' }, { awaitRelaySync: true })
  const p2tr = await receiver.create('public/slashpay/p2tr.json', { p2tr: 'bc1pxwww0ct9ue7e8tdnlmug5m2tamfn7q06sahstg39ys4c9f3340qqxrdu9k' }, { awaitRelaySync: true })
  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: { p2sh, p2tr }
  }, { awaitRelaySync: true })

  const sender = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  const params = {
    ...orderParams,
    frequency: 1, // 1 ms
    lastPaymentAt: Date.now() + 3,
    counterpartyURL: await receiver.getUrl(),
    amount: '1'
  }

  const paymentOrder = new PaymentOrder(params, db, sender)
  await paymentOrder.init()

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

      t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
      await paymentSender.stateUpdateCallback({
        id: paymentOrder.payments[i].id,
        pluginState: PLUGIN_STATES.SUCCESS
      })

      break
    }
    t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
    await paymentSender.stateUpdateCallback({
      id: paymentOrder.payments[i].id,
      pluginState: PLUGIN_STATES.SUCCESS
    })
  }

  t.is(submitSpy.callCount, stateUpdateSpy.callCount - 1) // -1 for last call
  t.is(paymentSender.paymentOrder.state, ORDER_STATE.COMPLETED)

  await t.exception(async () => { await paymentSender.submit() }, ORDER_ERRORS.CANNONT_PROCESS_ORDER)

  t.teardown(async () => {
    await relay.close()
    await dropTables(db)

    sinon.restore()

    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PaymentSender - recurring payment completely failed intermediate payment', async t => {
  const db = new DB({ name: 'test', path: './test_db' })
  await db.init()

  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const receiver = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  const p2sh = await receiver.create('public/slashpay/p2sh.json', { p2sh: '342ftSRCvFHfCeFFBuz4xwbeqnDw6BGUey' }, { awaitRelaySync: true })
  const p2tr = await receiver.create('public/slashpay/p2tr.json', { p2tr: 'bc1pxwww0ct9ue7e8tdnlmug5m2tamfn7q06sahstg39ys4c9f3340qqxrdu9k' }, { awaitRelaySync: true })
  await receiver.create(SLASHPAY_PATH, {
    paymentEndpoints: { p2sh, p2tr }
  }, { awaitRelaySync: true })

  const sender = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  const params = {
    ...orderParams,
    frequency: 1, // 1 ms
    lastPaymentAt: Date.now() + 3,
    counterpartyURL: await receiver.getUrl(),
    amount: '1'
  }

  const paymentOrder = new PaymentOrder(params, db, sender)
  await paymentOrder.init()

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

      t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
      await paymentSender.stateUpdateCallback({
        id: paymentOrder.payments[i].id,
        pluginState: PLUGIN_STATES.FAILED
      })

      break
    }
    t.is(paymentSender.paymentOrder.state, ORDER_STATE.PROCESSING)
    await paymentSender.stateUpdateCallback({
      id: paymentOrder.payments[i].id,
      pluginState: PLUGIN_STATES.SUCCESS
    })
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
    await relay.close()
    await dropTables(db)

    sinon.restore()

    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})
