const { test } = require('brittle')
const sinon = require('sinon')

const { PaymentState, PAYMENT_STATE, ERRORS } = require('../../src/payments/PaymentState')

const update = sinon.stub()
const payment = {
  update,
  db: { ready: true }
}

test('PaymentState.validate', t => {
  t.exception(() => PaymentState.validate(), /Payment is required/)
  t.exception(() => PaymentState.validate({}), /Payment db is required/)
  t.exception(() => PaymentState.validate({ db: {} }), /Payment db is not ready/)

  t.execution(() => PaymentState.validate(payment))
})

test('PaymentState.constructor', t => {
  const pS = new PaymentState(payment)

  t.is(pS.state, PAYMENT_STATE.INITIAL)
  t.alike(pS.pendingPlugins, [])
  t.alike(pS.processedBy, [])
  t.is(pS.processingPlugin, null)
  t.is(pS.sentByPlugin, null)
  t.is(pS.payment, payment)
})

test('PaymentState.serialize', t => {
  const pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  t.alike(pS.serialize(), {
    state: PAYMENT_STATE.INITIAL,
    pendingPlugins: [],
    processedBy: [],
    processingPlugin: null,
    sentByPlugin: null
  })
})

test('PaymentState.currentState', t => {
  let pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  t.is(pS.currentState(), PAYMENT_STATE.INITIAL)
  pS = new PaymentState(payment, PAYMENT_STATE.IN_PROGRESS)
  t.is(pS.currentState(), PAYMENT_STATE.IN_PROGRESS)
})

test('PaymentState.isInitial', t => {
  let pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  t.is(pS.isInitial(), true)
  pS = new PaymentState(payment, PAYMENT_STATE.IN_PROGRESS)
  t.is(pS.isInitial(), false)
})

test('PaymentState.isInProgress', t => {
  let pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  t.is(pS.isInProgress(), false)
  pS = new PaymentState(payment, PAYMENT_STATE.IN_PROGRESS)
  t.is(pS.isInProgress(), true)
})

test('PaymentState.isCompleted', t => {
  let pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  t.is(pS.isCompleted(), false)
  pS = new PaymentState(payment, PAYMENT_STATE.COMPLETED)
  t.is(pS.isCompleted(), true)
})

test('PaymentState.isFailed', t => {
  let pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  t.is(pS.isFailed(), false)
  pS = new PaymentState(payment, PAYMENT_STATE.FAILED)
  t.is(pS.isFailed(), true)
})

test('PaymentState.isCancelled', t => {
  let pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  t.is(pS.isCancelled(), false)
  pS = new PaymentState(payment, PAYMENT_STATE.CANCELLED)
  t.is(pS.isCancelled(), true)
})

test('PaymentState.isFinal', t => {
  let pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  t.is(pS.isFinal(), false)
  pS = new PaymentState(payment, PAYMENT_STATE.COMPLETED)
  t.is(pS.isFinal(), true)
  pS = new PaymentState(payment, PAYMENT_STATE.FAILED)
  t.is(pS.isFinal(), true)
  pS = new PaymentState(payment, PAYMENT_STATE.CANCELLED)
  t.is(pS.isFinal(), true)
})

test('PaymentState.cancel', async t => {
  let pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  await pS.cancel()

  t.is(pS.state, PAYMENT_STATE.CANCELLED)
  t.is(update.callCount, 1)

  await t.exception(async () => await pS.cancel(), ERRORS.INVALID_STATE(PAYMENT_STATE.CANCELLED))

  t.teardown(() => {
    update.resetHistory()
  })
})

test('PaymentState.fail', async t => {
  let pS = new PaymentState(payment, PAYMENT_STATE.IN_PROGRESS)
  await pS.fail()

  t.is(pS.state, PAYMENT_STATE.FAILED)
  t.is(update.callCount, 1)

  await t.exception(async () => await pS.fail(), ERRORS.INVALID_STATE(PAYMENT_STATE.FAILED))

  pS = new PaymentState(payment, PAYMENT_STATE.INITIAL)
  await t.exception(async () => await pS.fail(), ERRORS.INVALID_STATE(PAYMENT_STATE.INITIAL))

  t.teardown(() => {
    update.resetHistory()
  })
})
