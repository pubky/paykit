// TODO: expose state interface via native methods
// - getCurrentPlugin
// - failCurrentPlugin
// - isFinalState
// - isInProgress
// TODO: add properties specific to incoming payment

const { SlashtagsAccessObject } = require('../SlashtagsAccessObject')
const { PaymentAmount } = require('./PaymentAmount')
const { PaymentState, PAYMENT_STATE, PLUGIN_STATE } = require('./PaymentState')
/**
 * Payment class
 * @class Payment
 */
class Payment {
  /**
   * Generate random id
   * @returns {string}
   */
  static generateId () {
    // uuid is not available with runtime because of the crypto module
    // TODO: figure out how to use it
    return 'totally-random-id'
  }

  /**
   * Validate payment parameters
   * @param {PaymentParams} paymentParams - payment parameters
   * @throws {Error} - if paymentParams is invalid
   * @returns {void}
   */
  static validatePaymentParams (paymentParams) {
    if (!paymentParams) throw new Error(ERRORS.PARAMS_REQUIRED)
    if (!paymentParams.orderId) throw new Error(ERRORS.ORDER_ID_REQUIRED)
    if (!paymentParams.clientOrderId) throw new Error(ERRORS.CLIENT_ID_REQUIRED)
    if (!paymentParams.targetURL) throw new Error(ERRORS.TARGET_REQUIRED)
  }

  /**
   * Validate database
   * @param {DB} db - database
   * @throws {Error} - if db is invalid
   * @returns {void}
   */
  static validateDB (db) {
    if (!db) throw new Error(ERRORS.NO_DB)
    if (!db.ready) throw new Error(ERRORS.DB_NOT_READY)
  }

  /**
   * Validates payment object
   * @param {Payment} pO - payment object
   * @throws {Error} - if payment object is invalid
   * @returns {void}
   */
  static validatePaymentObject (pO) {
    if (!pO.id) throw new Error(ERRORS.ID_REQUIRED)
    if (!pO.internalState) throw new Error(ERRORS.INTERNAL_STATE_REQUIRED)

    Payment.validatePaymentParams(pO)
    PaymentAmount.validate(pO)
  }

  /**
   * @constructor Payment
   * @param {PaymentParams} paymentParams
   * @property {string} [paymentParmas.id] - payment id
   * @property {PaymentState} [paymentParams.internalState] - internal state of the payment
   * @property {string} targetURL - destination of the payment
   * @property {string} clientOrderId - client payment id
   * @property {Amount} amount - amount of the payment
   * @property {string[]} sendingPriority - list of plugins to use to send the payment
   *
   * @param {config} config
   * @property {config} db - database
   */

  constructor (paymentParams, db) {
    Payment.validatePaymentParams(paymentParams)
    Payment.validateDB(db)

    this.db = db
    this.sendingPriority = paymentParams.sendingPriority || []

    this.id = paymentParams.id || null
    this.orderId = paymentParams.orderId
    this.clientOrderId = paymentParams.clientOrderId

    this.targetURL = paymentParams.targetURL
    this.memo = paymentParams.memo || ''

    this.amount = new PaymentAmount(paymentParams)
    this.internalState = new PaymentState(this, paymentParams)

    this.createdAt = paymentParams.createdAt || Date.now()
    this.executeAt = paymentParams.executeAt || Date.now()
  }

  /**
   * Connects to remote targetURL and creates local payment priority
   * @returns {Promise<void>}
   * @throws {Error} - if no mutual plugins are available
   */
  async init () {
    const remoteStorage = new SlashtagsAccessObject()
    // XXX: url may contain path to payment file
    await remoteStorage.init(this.targetURL)
    const paymentFile = await remoteStorage.read('/slashpay.json')
    if (!paymentFile) throw new Error(ERRORS.NO_PAYMENT_FILE)

    const pendingPlugins = this.sendingPriority.filter((p) => {
      return Object.keys(paymentFile.paymentEndpoints).includes(p)
    })

    if (!pendingPlugins.length) throw new Error(ERRORS.NO_MATCHING_PLUGINS)
    this.internalState.assignPendingPlugins(pendingPlugins)
  }

  /**
   * Serialize payment object
   * @returns {SerializedPayment}
   */
  serialize () {
    return {
      id: this.id,
      orderId: this.orderId,
      clientOrderId: this.clientOrderId,
      targetURL: this.targetURL,
      memo: this.memo,
      sendingPriority: this.sendingPriority,
      createdAt: this.createdAt,
      executeAt: this.executeAt,
      // XXX: this is not a good idea as it relies on internal implementation
      ...this.amount.serialize(),
      ...this.internalState.serialize()
    }
  }

  /**
   * Serialize payment object
   * @typedef {Object} SerializedPayment
   * @property {string|null} id - payment id
   * @property {string} clientOrderId - client payment id
   * @property {PAYMENT_STATE} internalState - internal state of the payment
   * @property {string} targetURL - destination of the payment
   * @property {string} amount - amount of the payment
   * @property {string} currency - currency of the payment
   * @property {string} denomination - denomination of the payment
   * @property {string[]} sendingPriority - list of plugins to use to send the payment
   * @property {string[]} processedBy - list of plugins that processed the payment
   * @property {string|null} processingPlugin - plugin that is currently processing the payment
   */

  /**
   * Save payment to db
   * @returns {Promise<void>}
   * @throws {Error} - if payment is not valid
   */
  async save () {
    if (this.id) {
      const payment = await this.db.get(this.id, { removed: '*' })
      if (payment) throw new Error(ERRORS.ALREADY_EXISTS(this.id))
    }

    this.id = Payment.generateId()
    const paymentObject = this.serialize()
    Payment.validatePaymentObject(paymentObject)
    await this.db.save(paymentObject)
  }

  /**
   * Soft Delete payment from db
   * @param {boolean} force - force delete
   * @returns {Promise<void>}
   */
  async delete (force = false) {
    if (force) {
      throw new Error(ERRORS.NOT_ALLOWED)
    }
    await this.db.update(this.id, { removed: true })
  }

  /**
   * Update payment in db
   * @returns {Promise<void>}
   * @throws {Error} - if payment is not valid
   */
  async update () {
    const serialized = this.serialize()
    Payment.validatePaymentObject(serialized)
    await this.db.update(this.id, serialized)
  }

  /**
   * Process payment by iterating through sendingPriority and updating internalState
   * @returns {Promise<Payment>}
   */
  async process () {
    try {
      await this.internalState.process()
    } catch (e) {
    }
    return this
  }

  /**
   * Complete payment by setting internalState to COMPLETED
   * @throws {Error} - if payment is not in progress
   * @returns {Promise<Payment>}
   */
  async complete () {
    await this.internalState.complete()
    return this
  }

  /**
   * Cancel payment by setting internalState to CANCELED
   * @throws {Error} - if payment is not initial
   * @returns {Promise<Payment>}
   */
  async cancel () {
    await this.internalState.cancel()
    return this
  }
}

/**
 * @typedef {Object} Error
 * @property {string} NO_PLUGINS - no plugins found
 * @property {string} CLIENT_ID_REQUIRED - clientOrderId is required
 * @property {string} TARGET_REQUIRED - targetURL is required
 */
const ERRORS = {
  PARAMS_REQUIRED: 'params are required',
  ORDER_ID_REQUIRED: 'orderId is required',
  ALREADY_EXISTS: (id) => `Payment id: ${id} already exists`,
  NO_DB: 'No database provided',
  DB_NOT_READY: 'Database is not ready',
  NO_MATCHING_PLUGINS: 'No plugins found',
  CLIENT_ID_REQUIRED: 'clientOrderId is required',
  TARGET_REQUIRED: 'targetURL is required',
  NOT_ALLOWED: 'Not allowed',
  NO_PAYMENT_FILE: 'No payment file found'
}

module.exports = {
  Payment,
  PAYMENT_STATE,
  PLUGIN_STATE,
  ERRORS
}
