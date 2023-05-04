const { test } = require('brittle')
const sinon = require('sinon')

const { ERRORS, PaymentAmount } = require('../../src/payments/PaymentAmount')

test('PaymentAmount: validateAmount', (t) => {
  t.exception(() => PaymentAmount.validateAmount(), ERRORS.AMOUNT_REQUIRED)
  t.exception(() => PaymentAmount.validateAmount(''), ERRORS.AMOUNT_MUST_BE_NUMBERIC_STRING)
  t.exception(() => PaymentAmount.validateAmount('a'), ERRORS.AMOUNT_MUST_BE_NUMBERIC_STRING)
  t.exception(() => PaymentAmount.validateAmount(NaN), ERRORS.AMOUNT_MUST_BE_NUMBERIC_STRING)
  t.exception(() => PaymentAmount.validateAmount('1.1'), ERRORS.AMOUNT_MUST_BE_POSITIVE_INTEGER)
  t.exception(() => PaymentAmount.validateAmount('01'), ERRORS.AMOUNT_MUST_BE_POSITIVE_INTEGER)
  t.exception(() => PaymentAmount.validateAmount('99999999999999999'), ERRORS.AMOUNT_EXCEEDS_MAX)

  t.execution(() => PaymentAmount.validateAmount('2100000000000000'))
})

test('PaymentAmount: validateCurrency', (t) => {
  t.exception(() => PaymentAmount.validateCurrency(), ERRORS.CURRENCY_REQUIRED)
  t.exception(() => PaymentAmount.validateCurrency(''), ERRORS.NOT_SUPPORTED_CURRENCY(''))
  t.exception(() => PaymentAmount.validateCurrency('USD'), ERRORS.NOT_SUPPORTED_CURRENCY('USD'))

  t.execution(() => PaymentAmount.validateCurrency('BTC'))
})

test('PaymentAmount: validateDenomination', (t) => {
  t.exception(() => PaymentAmount.validateDenomination(), ERRORS.DENOMINATION_REQUIRED)
  t.exception(() => PaymentAmount.validateDenomination(''), ERRORS.NOT_SUPPORTED_DENOMINATION(''))
  t.exception(() => PaymentAmount.validateDenomination('USD'), ERRORS.NOT_SUPPORTED_DENOMINATION('USD'))

  t.execution(() => PaymentAmount.validateDenomination('BASE'))
})

test('PaymentAmount: validate', (t) => {
  const validateAmount = sinon.spy(PaymentAmount, 'validateAmount')
  const validateCurrency = sinon.spy(PaymentAmount, 'validateCurrency')
  const validateDenomination = sinon.spy(PaymentAmount, 'validateDenomination')

  t.execution(() => PaymentAmount.validate({ amount: '1', currency: 'BTC', denomination: 'BASE' }))

  t.is(validateAmount.callCount, 1)
  t.is(validateCurrency.callCount, 1)
  t.is(validateDenomination.callCount, 1)

  t.teardown(() => {
    sinon.restore()
  })
})

test('PaymentAmount: constructor', (t) => {
  const validate = sinon.spy(PaymentAmount, 'validate')

  const pAmount = new PaymentAmount({ amount: '1', currency: 'BTC', denomination: 'BASE' })

  t.is(validate.callCount, 1)
  t.is(pAmount.amount, '1')
  t.is(pAmount.currency, 'BTC')
  t.is(pAmount.denomination, 'BASE')

  t.teardown(() => {
    sinon.restore()
  })
})

test('PaymentAmount: serialize', (t) => {
  const pAmount = new PaymentAmount({ amount: '1', currency: 'BTC', denomination: 'BASE' })

  t.alike(pAmount.serialize(), {
    amount: '1',
    currency: 'BTC',
    denomination: 'BASE'
  })
})
