const logger = require('slashtags-logger')('Paykit', 'incoming-payment')

const { v4: uuidv4 } = require('uuid')

const { PaymentAmount } = require('./PaymentAmount')
const { PAYMENT_STATE, PLUGIN_STATE } = require('./PaymentState')
/**
 * PaymentIncoming class
 * @class PaymentIncoming
 * @property {string} id - payment id
 * @property {string} clientOrderId - client payment id
 * @property {string} memo - memo of the payment
 * @property {Amount} amount - amount of the payment
 * @property {PaymentState} internalState - internal state of the payment
 * @property {Date} createdAt - creation timestamp of the payment
 * @property {Date} receivedAt - execution timestamp of the payment
 */
class PaymentIncoming {
  /**
   * Generate random id
   * @returns {string}
   */
  static generateId () {
    return uuidv4()
  }

  /**
   * Validate payment parameters
   * @param {PaymentParams} paymentParams - payment parameters
   * @throws {Error} - if paymentParams is invalid
   * @returns {void}
   */
  static validatePaymentParams (paymentParams) {
    if (!paymentParams) throw new Error(ERRORS.PARAMS_REQUIRED)
  }

  /**
   * Validate database
   * @param {DB} db - database
   * @throws {Error} - if db is invalid
   * @returns {void}
   */
  static validateDB (db) {
    if (!db) throw new Error(ERRORS.NO_DB)
  }

  /**
   * Validates payment object
   * @param {Payment} pO - payment object
   * @throws {Error} - if payment object is invalid
   * @returns {void}
   */
  static validatePaymentObject (pO) {
    if (!pO) throw new Error(ERRORS.PAYMENT_OBJECT_REQUIRED)
    if (!pO.id) throw new Error(ERRORS.ID_REQUIRED)
    // if (!pO.internalState) throw new Error(ERRORS.INTERNAL_STATE_REQUIRED)

    PaymentIncoming.validatePaymentParams(pO)
    if (pO.amount) PaymentAmount.validate(pO)
  }

  /**
   * @constructor PaymentIncoming
   * @param {PaymentParams} paymentParams
   * @property {string} [paymentParmas.id] - payment object id
   * @property {PaymentState} [paymentParams.internalState] - internal state of the payment
   * @property {string} paymentParams.clientOrderId - client payment id
   * @property {Amount} paymentParams.amount - amount of the payment
   * @param {db} db - database
   * @param {TransportConnector} [transportConnector] - TransportConnector connector
   */

  constructor (paymentParams, db, transportConnector) {
    logger.info('Creating payment object')
    logger.debug(`Creating payment object with ${JSON.stringify(paymentParams)}`)

    PaymentIncoming.validatePaymentParams(paymentParams)
    PaymentIncoming.validateDB(db)

    this.db = db
    this.transportConnector = transportConnector

    this.id = paymentParams.id || null
    this.clientOrderId = paymentParams.clientOrderId

    this.memo = paymentParams.memo || ''

    if (paymentParams.amount) {
      this.amount = new PaymentAmount(paymentParams)
    }
    if (paymentParams.expectedAmount) {
      this.expectedAmount = new PaymentAmount({
        amount: paymentParams.expectedAmount,
        currency: paymentParams.expectedCurrency,
        denomination: paymentParams.expectedDenomination
      })
    }

    this.internalState = paymentParams.internalState || PAYMENT_STATE.INITIAL

    this.receivedByPlugins = paymentParams.receivedByPlugins || []

    this.createdAt = paymentParams.createdAt || Date.now()

    this.logger = {
      debug: (msg) => { logger.debug.extend(JSON.stringify(this.serialize()))({ msg }) },
      info: (msg) => { logger.info.extend(JSON.stringify(this.serialize()))({ msg }) }
    }
  }

  /**
   * Returns string representation of payment state used for logging
   */
  [Symbol.for('nodejs.util.inspect.custom')] () {
    return JSON.stringify(this.serialize())
  }

  /**
   * Serialize payment object
   * @returns {SerializedPayment}
   */
  serialize () {
    const serialized = {
      id: this.id,
      clientOrderId: this.clientOrderId,
      memo: this.memo,
      createdAt: this.createdAt,
      receivedAt: this.receivedAt,
      receivedByPlugins: this.receivedByPlugins,
      internalState: this.internalState,
      ...this.amount?.serialize()
    }
    if (this.expectedAmount) {
      const serializedAmount = this.expectedAmount.serialize()
      serialized.expectedAmount = serializedAmount.amount
      serialized.expectedCurrency = serializedAmount.currency
      serialized.expectedDenomination = serializedAmount.denomination
    }

    return serialized
  }

  /**
   * Serialized payment object
   * @typedef {Object} SerializedPayment
   * @property {string|null} id - payment id
   * @property {string} clientOrderId - client payment id
   * // serialized amount
   * @property {string} amount - amount of the payment
   * @property {string} currency - currency of the payment
   * @property {string} denomination - denomination of the payment
   * // serialized state
   */

  /**
   * Save payment object to db - if persist is true, payment will be saved to db,
   * otherwise it will return { statement, params } query object
   * @returns {Promise<Database| { statement: string, params: object }>}
   * @throws {Error} - if payment object is not valid
   */
  async save (persist = true) {
    this.logger.info('Saving payment object')
    if (!this.id) {
      this.id = PaymentIncoming.generateId()
    }

    const paymentObject = await this.db.getIncomingPayment(this.id, { removed: '*' })
    if (paymentObject) throw new Error(ERRORS.ALREADY_EXISTS(this.id))

    const serialized = this.serialize()
    PaymentIncoming.validatePaymentObject(serialized)
    const res = await this.db.saveIncomingPayment(serialized, persist)
    this.logger.debug('Payment object saved')

    return res
  }

  /**
   * Soft Delete payment from db
   * @param {boolean} force - force delete
   * @returns {Promise<void>}
   */
  async delete (force = false) {
    this.logger.info('Deleting payment object')
    if (force) {
      this.logger.info('Force deleting payment object')
      throw new Error(ERRORS.NOT_ALLOWED)
    }
    await this.db.updateIncomingPayment(this.id, { removed: true })
    this.logger.debug('Payment object deleted')
  }

  /**
   * Update payment in db - if persist is true, payment will be updated in db,
   * otherwise it will return { statement, params } query object
   * @returns {Promise<Database| { statement: string, params: object }>}
   * @throws {Error} - if payment is not valid
   */
  async update (persist = true) {
    this.logger.info('Updating payment object')

    const serialized = this.serialize()
    PaymentIncoming.validatePaymentObject(serialized)
    const res = await this.db.updateIncomingPayment(this.id, serialized, persist)

    this.logger.debug('Payment object updated')
    return res
  }
}

/**
 * @typedef {Object} Error
 * @property {string} NO_PLUGINS - no plugins found
 * @property {string} NOT_ALLOWED - not allowed
 * @property {string} NO_PAYMENT_FILE - no payment file found
 * @property {string} INVALID_PLUGIN_STATE - invalid plugin state
 */
const ERRORS = {
  ID_REQUIRED: 'id is required',
  PARAMS_REQUIRED: 'params are required',
  PAYMENT_OBJECT_REQUIRED: 'payment object is required',
  ALREADY_EXISTS: (id) => `Payment id: ${id} already exists`,
  NO_DB: 'No database provided',
  NOT_ALLOWED: 'Not allowed',
  NO_PAYMENT_FILE: 'No payment file found',
  INVALID_PLUGIN_STATE: (state) => `Invalid plugin state ${state}`
}

module.exports = {
  PaymentIncoming,
  PAYMENT_STATE,
  PLUGIN_STATE,
  ERRORS
}
