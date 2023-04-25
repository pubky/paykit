const { assert } = require('../utils')

const CURRENCIES = [
  'BTC',
]

const DENOMINATIONS = [
  'BASE', // satoshi
  'MAIN', // bitcoin
]

class PaymentAmount {
  constructor ({
    amount,
    currency = 'BTC',
    denomination = 'BASE' // satoshi
  }) {
    PaymentAmount.validate({ amount, currency, denomination })

    this.amount = amount
    this.currency = currency
    this.denomination = denomination
  }

  serialize () {
    return {
      amount: this.amount,
      currency: this.currency,
      denomination: this.denomination
    }
  }

  static validate (params) {
    assert(params, ERRORS.PARAMS_REQUIRED)

    PaymentAmount.validateAmount(params.amount)
    PaymentAmount.validateCurrency(params.currency)
    PaymentAmount.validateDenomination(params.denomination)
  }

  static validateAmount (amount) {
    assert(amount, ERRORS.AMOUNT_REQUIRED)
    assert(typeof amount === 'string', ERRORS.AMOUNT_MUST_BE_NUMBERIC_STRING)
    assert(!isNaN(amount), ERRORS.AMOUNT_MUST_BE_NUMBERIC_STRING)
    assert(/^\d+$/.test(amount), ERRORS.AMOUNT_MUST_BE_POSITIVE_INTEGER)
    assert(amount[0] !== '0', ERRORS.AMOUNT_MUST_BE_POSITIVE_INTEGER )

    // NOTE: 21 million BTC in satoshi
    assert(amount.length <= 16, ERRORS.AMOUNT_EXCEEDS_MAX)
  }

  static validateCurrency (currency) {
    assert(currency, ERRORS.CURRENCY_REQUIRED)
    assert(CURRENCIES.includes(currency), ERRORS.NOT_SUPPORTED_CURRENCY(currency))
  }

  static validateDenomination (denomination) {
    assert(denomination, ERRORS.DENOMINATION_REQUIRED)
    assert(DENOMINATIONS.includes(denomination), ERRORS.NOT_SUPPORTED_DENOMINATION(denomination))
  }
}

ERRORS = {
  PARAMS_REQUIRED: 'params are required',

  AMOUNT_REQUIRED: 'amount is required',
  AMOUNT_MUST_BE_NUMBERIC_STRING: 'amount must be a numberic string',
  AMOUNT_MUST_BE_POSITIVE_INTEGER: 'amount must be positive integer',
  AMOUNT_EXCEEDS_MAX: 'amount exceeds 16 digits',

  CURRENCY_REQUIRED: 'currency is required',
  NOT_SUPPORTED_CURRENCY: (c) => `not supported currency: ${c}`,

  DENOMINATION_REQUIRED: 'denomination is required',
  NOT_SUPPORTED_DENOMINATION: (d) => `not supported denomination: ${d}`,
}

module.exports = {
  PaymentAmount,
  ERRORS
}
