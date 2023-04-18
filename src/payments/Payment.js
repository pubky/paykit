const { SlashtagsAccessObject } = require('../SlashtagsAccessObject')
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
    if (!paymentParams.clientPaymentId) throw new Error(ERROR.CLIENT_ID_REQUIRED)
    if (!paymentParams.amount) throw new Error(ERROR.AMOUNT_REQUIRED)
    // if (!paymentParams.currency) throw new Error(ERROR.CURRENCY_REQUIRED)
    // if (!paymentParams.denomination) throw new Error(ERROR.DENOMINATION_REQUIRED)
    if (!paymentParams.targetURL) throw new Error(ERROR.TARGET_REQUIRED)
  }

  /**
   * Validate payment object
   * @param {PaymentParams} paymentParams - payment parameters
   * @throws {Error} - if paymentParams is invalid
   * @returns {void}
   */
  static validatePaymentConfig (paymentConfig) {
    if (!paymentConfig.sendingPriority) throw new Error(ERROR.NO_SENDING_PRIORITY)
  }

  /**
   * Validate database
   * @param {DB} db - database
   * @throws {Error} - if db is invalid
   * @returns {void}
   */
  static validateDB (db) {
    if (!db) throw new Error(ERROR.NO_DB)
    if (!db.ready) throw new Error(ERROR.DB_NOT_READY)
  }

  /**
   * Validates payment object
   * @param {Payment} pO - payment object
   * @throws {Error} - if payment object is invalid
   * @returns {void}
   */
  static validatePaymentObject (pO) {
    if (!pO.id) throw new Error(ERROR.ID_REQUIRED)
    if (!pO.internalState) throw new Error(ERROR.INTERNAL_STATE_REQUIRED)

    Payment.validatePaymentParams(pO)

    if (!pO.currency) throw new Error(ERROR.CURRENCY_REQUIRED)
    if (!pO.denomination) throw new Error(ERROR.DENOMINATION_REQUIRED)
    if (!pO.sendingPriority) throw new Error(ERROR.SENDING_PRIORITY_REQUIRED)
  }

  /**
   * @constructor Payment
   * @param {PaymentParams} paymentParams
   * @property {string} [paymentParmas.id] - payment id
   * @property {PAYMENT_STATE} [paymentParams.internalState] - internal state of the payment
   * @property {string} targetURL - destination of the payment
   * @property {string} clientPaymentId - client payment id
   * @property {string} amount - amount of the payment
   * @property {string} [currency] - currency of the payment, default is BTC
   * @property {string} [denomination] - denomination of the payment, default is BASE
   *
   * @param {PaymentConfig} paymentConfig
   * @property {string[]} sendingPriority - list of plugins to use to send the payment
   *
   * @param {config} config
   * @property {config} db - database
   */

  constructor (paymentParams, paymentConfig, db) {
    Payment.validatePaymentParams(paymentParams)
    Payment.validatePaymentConfig(paymentConfig)
    Payment.validateDB(db)

    this.db = db
    this.paymentConfig = paymentConfig

    if (paymentParams.id) throw new Error(ERROR.ALREADY_EXISTS(paymentParams.id))

    this.id = null
    this.internalState = paymentParams.internalState || PAYMENT_STATE.INITIAL
    this.processedBy = []
    this.targetURL = paymentParams.targetURL
    this.clientPaymentId = paymentParams.clientPaymentId
    this.amount = paymentParams.amount
    this.currency = paymentParams.currency || 'BTC'
    this.denomination = paymentParams.denomination || 'BASE' // satoshi
    this.processingPlugin = null
    this.sendingPriority = []
    this.sentByPlugin = null
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
    if (!paymentFile) throw new Error(ERROR.NO_PAYMENT_FILE)

    this.sendingPriority = this.paymentConfig.sendingPriority.filter((p) => {
      return Object.keys(paymentFile.paymentEndpoints).includes(p)
    })

    if (!this.sendingPriority.length) throw new Error(ERROR.NO_MATCHING_PLUGINS)
  }

  /**
   * Serialize payment object
   * @returns {SerializedPayment}
   */
  serialize () {
    return {
      id: this.id,
      clientPaymentId: this.clientPaymentId,
      internalState: this.internalState,
      targetURL: this.targetURL,
      amount: this.amount,
      currency: this.currency,
      denomination: this.denomination,
      sendingPriority: this.sendingPriority,
      processedBy: this.processedBy,
      processingPlugin: this.processingPlugin,
      sentByPlugin: this.sentByPlugin
    }
  }

  /**
   * Serialize payment object
   * @typedef {Object} SerializedPayment
   * @property {string|null} id - payment id
   * @property {string} clientPaymentId - client payment id
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
      if (payment) throw new Error(ERROR.ALREADY_EXISTS(this.id))
      // something very fishy is going on
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
    if (!force) {
      await this.db.update(this.id, { removed: true })
      // TODO: clean `this`
    } else {
      throw new Error(ERROR.NOT_ALLOWED)
    }
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
    // TODO: consider using plugin object with state instead of three properties
    if (this.internalState === PAYMENT_STATE.COMPLETED) return this
    if (this.internalState === PAYMENT_STATE.FAILED) return this

    if (!this.processingPlugin && this.internalState !== PAYMENT_STATE.IN_PROGRESS) {
      this.processingPlugin = this.sendingPriority.shift()
      this.internalState = PAYMENT_STATE.IN_PROGRESS
      await this.update()
      return this
    }

    this.processedBy.push(this.processingPlugin)

    const nextPlugin = this.sendingPriority.shift()
    if (!nextPlugin) {
      this.processingPlugin = null
      this.internalState = PAYMENT_STATE.FAILED
      await this.update()
      return this
    }

    this.processingPlugin = nextPlugin
    this.internalState = PAYMENT_STATE.IN_PROGRESS
    await this.update()

    return this
  }

  /**
   * Complete payment by setting internalState to COMPLETED
   * @throws {Error} - if payment is not in progress
   * @returns {Promise<Payment>}
   */
  async complete () {
    if (this.internalState !== PAYMENT_STATE.IN_PROGRESS) throw new Error(ERROR.CAN_NOT_COMPLETE(this.internalState))

    this.processedBy.push(this.processingPlugin)
    this.sentByPlugin = this.processingPlugin
    this.processingPlugin = null
    this.internalState = PAYMENT_STATE.COMPLETED

    await this.update()

    return this
  }
}

/**
 * @typedef {Object} Error
 * @property {string} NO_PLUGINS - no plugins found
 * @property {string} CLIENT_ID_REQUIRED - clientPaymentId is required
 * @property {string} AMOUNT_REQUIRED - amount is required
 * // @property {string} CURRENCY_REQUIRED - currency is required
 * // @property {string} DENOMINATION_REQUIRED - denomination is required
 * @property {string} TARGET_REQUIRED - targetURL is required
 * @property {string} NO_REMOTE_STORAGE - no remote storage provided
 */
const ERROR = {
  ALREADY_EXISTS: (id) => `Payment id: ${id} already exists`,
  NO_DB: 'No database provided',
  DB_NOT_READY: 'Database is not ready',
  NO_MATCHING_PLUGINS: 'No plugins found',
  CLIENT_ID_REQUIRED: 'clientPaymentId is required',
  AMOUNT_REQUIRED: 'amount is required',
  // CURRENCY_REQUIRED: 'currency is required',
  // DENOMINATION_REQUIRED: 'denomination is required',
  TARGET_REQUIRED: 'targetURL is required',
  NOT_ALLOWED: 'Not allowed',
  CAN_NOT_COMPLETE: (state) => `Can not complete payment in state: ${state}`,

  NO_REMOTE_STORAGE: 'No remote storage provided',
  NO_PAYMENT_FILE: 'No payment file found',
  NO_SENDING_PRIORITY: 'No sending priority provided'
}

/**
 * @typedef {Object} PaymentState
 * @property {string} INITIAL - initial state
 * @property {string} IN_PROGRESS - in progress state
 * @property {string} COMPLETED - completed state
 * @property {string} FAILED - failed state
 * @property {string} CANCELED - canceled state
 */
const PAYMENT_STATE = {
  INITIAL: 'initial',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled'
}

module.exports = {
  Payment,
  PAYMENT_STATE,
  ERROR
}
