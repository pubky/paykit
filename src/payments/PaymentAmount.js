const { assert } = require('../utils')

/**
 * @constant CURRENCIES
 * @type {Array} CURRENCIES
 * @property {String} BTC - bitcoin
 */
const CURRENCIES = [
  'BTC'
]

/**
 * @constant DENOMINATIONS
 * @type {Array} DENOMINATIONS
 * @property {String} BASE - satoshi
 * @property {String} MAIN - bitcoin
 */
const DENOMINATIONS = [
  'BASE', // satoshi
  'MAIN' // bitcoin
]

/**
 * PaymentAmount
 * @class PaymentAmount represents the amount of a payment
 * @param {Object} params
 * @param {String} params.amount - amount in denomination
 * @param {String} params.currency - currency code
 * @param {String} params.denomination - denomination
 */
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

  /**
   * @returns {Object} serialized PaymentAmount
   */
  serialize (prefix = '') {
//    if (prefix !== '') {
//      return {
//        [`${prefix}Amount`]: this.amount,
//        [`${prefix}Currency`]: this.currency,
//        [`${prefix}Denomination`]: this.denomination
//      }
//    }
    return {
      amount: this.amount,
      currency: this.currency,
      denomination: this.denomination
    }
  }

  /**
   * @static validate
   * @param {Object} params - params to validate
   * @throws {ERROR} if params are invalid
   * @returns {void}
   */
  static validate (params) {
    assert(params, ERRORS.PARAMS_REQUIRED)

    PaymentAmount.validateAmount(params.amount)
    PaymentAmount.validateCurrency(params.currency)
    PaymentAmount.validateDenomination(params.denomination)
  }

  /**
   * @static validateAmount
   * @param {String} amount - amount to validate
   * @throws {ERROR} if amount is invalid
   * @returns {void}
   */
  static validateAmount (amount) {
    assert(amount, ERRORS.AMOUNT_REQUIRED)
    assert(typeof amount === 'string', ERRORS.AMOUNT_MUST_BE_NUMBERIC_STRING)
    assert(!isNaN(amount), ERRORS.AMOUNT_MUST_BE_NUMBERIC_STRING)
    assert(/^\d+$/.test(amount), ERRORS.AMOUNT_MUST_BE_POSITIVE_INTEGER)
    assert(amount[0] !== '0', ERRORS.AMOUNT_MUST_BE_POSITIVE_INTEGER)

    // NOTE: 21 million BTC in satoshi
    assert(amount.length <= 16, ERRORS.AMOUNT_EXCEEDS_MAX)
  }

  /**
   * @static validateCurrency
   * @param {String} currency - currency to validate
   * @throws {ERROR} if currency is invalid
   * @returns {void}
   */
  static validateCurrency (currency) {
    assert(currency, ERRORS.CURRENCY_REQUIRED)
    assert(CURRENCIES.includes(currency), ERRORS.NOT_SUPPORTED_CURRENCY(currency))
  }

  /**
   * @static validateDenomination
   * @param {String} denomination - denomination to validate
   * @throws {ERROR} if denomination is invalid
   * @returns {void}
   */
  static validateDenomination (denomination) {
    assert(denomination, ERRORS.DENOMINATION_REQUIRED)
    assert(DENOMINATIONS.includes(denomination), ERRORS.NOT_SUPPORTED_DENOMINATION(denomination))
  }
}

/**
 * @constant ERRORS
 * @type {Object} ERRORS
 * @property {String} PARAMS_REQUIRED - params are required
 * @property {String} AMOUNT_REQUIRED - amount is required
 * @property {String} AMOUNT_MUST_BE_NUMBERIC_STRING - amount must be a numberic string
 * @property {String} AMOUNT_MUST_BE_POSITIVE_INTEGER - amount must be positive integer
 * @property {String} AMOUNT_EXCEEDS_MAX - amount exceeds 16 digits
 * @property {String} CURRENCY_REQUIRED - currency is required
 * @property {String} NOT_SUPPORTED_CURRENCY - not supported currency
 * @property {String} DENOMINATION_REQUIRED - denomination is required
 * @property {String} NOT_SUPPORTED_DENOMINATION - not supported denomination
 */
const ERRORS = {
  PARAMS_REQUIRED: 'params are required',

  AMOUNT_REQUIRED: 'amount is required',
  AMOUNT_MUST_BE_NUMBERIC_STRING: 'amount must be a numberic string',
  AMOUNT_MUST_BE_POSITIVE_INTEGER: 'amount must be positive integer',
  AMOUNT_EXCEEDS_MAX: 'amount exceeds 16 digits',

  CURRENCY_REQUIRED: 'currency is required',
  NOT_SUPPORTED_CURRENCY: (c) => `not supported currency: ${c}`,

  DENOMINATION_REQUIRED: 'denomination is required',
  NOT_SUPPORTED_DENOMINATION: (d) => `not supported denomination: ${d}`
}

module.exports = {
  PaymentAmount,
  ERRORS,
  CURRENCIES,
  DENOMINATIONS
}
