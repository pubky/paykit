const sinon = require('sinon')
const { skip, test } = require('brittle')

const { DB } = require('../fixtures/db')
const db = new DB()

const { paymentConfig } = require('../fixtures/config')
const { paymentParams } = require('../fixtures/paymentParams')

const { PaymentManager } = require('../../src/payments/PaymentManager')

test('PaymentManager: constructor', async t => {
  const paymentManager = new PaymentManager(paymentConfig, db)

  t.alike(paymentManager.db, db)
  t.alike(paymentManager.config, paymentConfig)
  t.is(paymentManager.ready, false)
})

test('PaymentManager: init', async t => {
  const paymentManager = new PaymentManager(paymentConfig, db)
  const init = sinon.stub(db, 'init').resolves()

  await paymentManager.init()

  t.is(paymentManager.ready, true)
  t.is(init.calledOnce, true)

  t.teardown(() => {
    init.restore()
  })
})

skip('PaymentManager: sendPayment', async t => {
  const paymentManager = new PaymentManager(paymentConfig, db)
  await paymentManager.init()
  await paymentManager.sendPayment(paymentParams)
})

skip('PaymentManager: receivePayments', async t => {
  const paymentManager = new PaymentManager(paymentConfig, db)
  await paymentManager.init()
})

test('PaymentManager: entryPointForPlugin ask client', async t => {
  const paymentManager = new PaymentManager(paymentConfig, db)
  await paymentManager.init()

  const askClient = sinon.stub(paymentManager, 'askClient').resolves()

  paymentManager.entryPointForPlugin({ state: 'waitingForClient' })

  t.is(askClient.calledOnce, true)
  t.is(askClient.calledWith({ state: 'waitingForClient' }), true)

  t.teardown(() => askClient.restore())
})

test('PaymentManager: entryPointForPlugin createIncomingPayment', async t => {
  const paymentManager = new PaymentManager(paymentConfig, db)
  await paymentManager.init()

  const createIncomingPayment = sinon.stub(db, 'createIncomingPayment').resolves()

  paymentManager.entryPointForPlugin({ state: 'newPayment' })

  t.is(createIncomingPayment.calledOnce, true)
  t.is(createIncomingPayment.calledWith({ state: 'newPayment' }), true)

  t.teardown(() => createIncomingPayment.restore())
})

skip('PaymentManager: entryPointForUser', async t => {})
