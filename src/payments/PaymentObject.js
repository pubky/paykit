const logger = require('slashtags-logger')('Slashpay', 'payment-object')

const { v4: uuidv4 } = require('uuid')

const { PaymentAmount } = require('./PaymentAmount')
const { PaymentState, PAYMENT_STATE, PLUGIN_STATE } = require('./PaymentState')
/**
 * PaymentObject class
 * @class PaymentObject
 * @property {string} id - payment id
 * @property {string} orderId - order id
 * @property {string} clientOrderId - client payment id
 * @property {string} counterpartyURL - destination of the payment
 * @property {string} memo - memo of the payment
 * @property {string[]} sendingPriority - list of plugins to use to send the payment
 * @property {Amount} amount - amount of the payment
 * @property {PaymentState} internalState - internal state of the payment
 * @property {PaymentDirection} direction - direction of the payment
 * @property {Date} createdAt - creation timestamp of the payment
 * @property {Date} executeAt - execution timestamp of the payment
 */
class PaymentObject {
  /**
   * Generate random id
   * @returns {string}
   */
  static generateId () {
    return uuidv4()
  }

  /**
   * Validate payment direction
   * @param {PaymentDirection} direction - payment direction
   * @throws {Error} - if direction is invalid
   * @returns {void}
   */
  static validateDirection (paymentParams) {
    const { direction } = paymentParams
    if (!direction) return

    if (!Object.values(PAYMENT_DIRECTION).includes(direction)) throw new Error(ERRORS.INVALID_DIRECTION)

    if (direction === PAYMENT_DIRECTION.OUT) return

    const { completedByPlugin } = paymentParams

    if (!completedByPlugin) throw new Error(ERRORS.COMPLETED_BY_PLUGIN_REQUIRED)
    if (!completedByPlugin.name) throw new Error(ERRORS.COMPLETED_BY_PLUGIN_NAME_REQUIRED)
    if (!completedByPlugin.state) throw new Error(ERRORS.COMPLETED_BY_PLUGIN_STATE_REQUIRED)
    if (!Object.values(PLUGIN_STATE).includes(completedByPlugin.state)) {
      throw new Error(ERRORS.INVALID_PLUGIN_STATE(completedByPlugin.state))
    }
    if (!completedByPlugin.startAt) throw new Error(ERRORS.COMPLETED_BY_PLUGIN_START_AT_REQUIRED)
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
    if (!paymentParams.counterpartyURL) throw new Error(ERRORS.COUNTERPARTY_REQUIRED)
    PaymentObject.validateDirection(paymentParams)
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
    if (!pO) throw new Error(ERRORS.PAYMENT_OBJECT_REQUIRED)
    if (!pO.id) throw new Error(ERRORS.ID_REQUIRED)
    if (!pO.internalState) throw new Error(ERRORS.INTERNAL_STATE_REQUIRED)

    PaymentObject.validatePaymentParams(pO)
    PaymentAmount.validate(pO)
  }

  /**
   * @constructor PaymentObject
   * @param {PaymentParams} paymentParams
   * @property {string} [paymentParmas.id] - payment object id
   * @property {PaymentState} [paymentParams.internalState] - internal state of the payment
   * @property {string} paymentParams.counterpartyURL - destination of the payment
   * @property {string} paymentParams.clientOrderId - client payment id
   * @property {Amount} paymentParams.amount - amount of the payment
   * @property {string[]} paymentParams.sendingPriority - list of plugins to use to send the payment
   * @param {db} db - database
   * @param {SlashtagsConnector} [slashtagsConnector] - slashtags connector
   */

  constructor (paymentParams, db, slashtagsConnector) {
    logger.info('Creating payment object')
    logger.debug(`Creating payment object with ${JSON.stringify(paymentParams)}`)

    PaymentObject.validatePaymentParams(paymentParams)
    PaymentObject.validateDB(db)

    this.db = db
    this.sendingPriority = paymentParams.sendingPriority || []
    this.slashtagsConnector = slashtagsConnector

    this.id = paymentParams.id || null
    this.orderId = paymentParams.orderId
    this.clientOrderId = paymentParams.clientOrderId

    this.direction = paymentParams.direction || PAYMENT_DIRECTION.OUT

    this.counterpartyURL = paymentParams.counterpartyURL
    this.memo = paymentParams.memo || ''

    this.amount = new PaymentAmount(paymentParams)

    const statePaymentParams = { ...paymentParams }
    if (this.direction === PAYMENT_DIRECTION.IN) statePaymentParams.internalState = PAYMENT_STATE.COMPLETED

    this.internalState = new PaymentState(this, statePaymentParams)

    this.createdAt = paymentParams.createdAt || Date.now()
    this.executeAt = paymentParams.executeAt || Date.now()

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
   * Connects to remote counterpartyURL and creates local payment priority
   * @returns {Promise<void>}
   * @throws {Error} - if no mutual plugins are available
   */
  async init () {
    this.logger.info('Initializing payment')

    this.logger.debug('Retrieving payment file')
    const paymentFile = await this.slashtagsConnector.readRemote(this.counterpartyURL)
    if (!paymentFile) throw new Error(ERRORS.NO_PAYMENT_FILE)
    this.logger.debug('Retrieved payment file')

    this.logger.debug('Selecting pending plugins')
    const pendingPlugins = this.sendingPriority.filter((p) => {
      return Object.keys(paymentFile.paymentEndpoints).includes(p)
    })

    console.log('sending priority', this.sendingPriority)
    console.log('payment file', paymentFile)

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
      counterpartyURL: this.counterpartyURL,
      memo: this.memo,
      sendingPriority: this.sendingPriority,
      createdAt: this.createdAt,
      executeAt: this.executeAt,
      direction: this.direction,
      // NOTE: ORM will be nice here
      ...this.amount?.serialize(),
      ...this.internalState?.serialize()
    }
  }

  /**
   * Serialized payment object
   * @typedef {Object} SerializedPayment
   * @property {string|null} id - payment id
   * @property {string} clientOrderId - client payment id
   * @property {PAYMENT_STATE} internalState - internal state of the payment
   * @property {string} counterpartyURL - destination of the payment
   * // serialized amount
   * @property {string} amount - amount of the payment
   * @property {string} currency - currency of the payment
   * @property {string} denomination - denomination of the payment
   * // serialized state
   * @property {string[]} sendingPriority - list of plugins to use to send the payment
   * @property {string[]} processedBy - list of plugins that processed the payment
   * @property {string|null} processingPlugin - plugin that is currently processing the payment
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
      this.id = PaymentObject.generateId()
    }

    const paymentObject = await this.db.getPayment(this.id, { removed: '*' })
    if (paymentObject) throw new Error(ERRORS.ALREADY_EXISTS(this.id))

    const serialized = this.serialize()
    PaymentObject.validatePaymentObject(serialized)
    const res = await this.db.savePayment(serialized, persist)
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
    await this.db.updatePayment(this.id, { removed: true })
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
    PaymentObject.validatePaymentObject(serialized)
    const res = await this.db.updatePayment(this.id, serialized, persist)

    this.logger.debug('Payment object updated')
    return res
  }

  /**
   * Process payment by iterating through sendingPriority and updating internalState
   * @returns {Promise<PaymentObject>}
   */
  async process () {
    try {
      await this.internalState.process()
    } catch (e) {
      this.logger.debug(`Could not start payment processing, ${e.message}`)
    }

    return this
  }

  /**
   * Complete payment by setting internalState to COMPLETED
   * @throws {Error} - if payment is not in progress
   * @returns {Promise<PaymentObject>}
   */
  async complete () {
    await this.internalState.complete()

    return this
  }

  /**
   * Cancel payment by setting internalState to CANCELED, if persist is true, payment will be updated in db,
   * otherwise it will return { statement, params } query object
   *
   * @throws {Error} - if payment is not initial
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async cancel (persist = true) {
    const res = await this.internalState.cancel(persist)

    return res
  }

  /**
   * get current plugin from state
   * @returns {Plugin|null}
   */
  getCurrentPlugin () {
    return this.internalState.currentPlugin
  }

  /**
   * fail current plugin
   * @returns {Promise<PaymentObject>}
   */
  async failCurrentPlugin () {
    await this.internalState.failCurrentPlugin()

    return this
  }

  /**
   * checks if payment is in progress
   * @returns {boolean}
   */
  isInProgress () {
    return this.internalState.isInProgress()
  }

  /**
   * checks if payment is in final state
   * @returns {boolean}
   */
  isFinal () {
    return this.internalState.isFinal()
  }

  /**
   * checks if payment is failed
   * @returns {boolean}
   */
  isFailed () {
    return this.internalState.isFailed()
  }
}

/**
 * @typedef {Object} Error
 * @property {string} NO_PLUGINS - no plugins found
 * @property {string} CLIENT_ID_REQUIRED - clientOrderId is required
 * @property {string} COUNTERPARTY_REQUIRED - counterpartyURL is required
 * @property {string} NOT_ALLOWED - not allowed
 * @property {string} NO_PAYMENT_FILE - no payment file found
 * @property {string} INVALID_DIRECTION - invalid payment direction
 * @property {string} COMPLETED_BY_PLUGIN_REQUIRED - completedByPlugin is required
 * @property {string} COMPLETED_BY_PLUGIN_NAME_REQUIRED - completedByPlugin.name is required
 * @property {string} COMPLETED_BY_PLUGIN_STATE_REQUIRED - completedByPlugin.state is required
 * @property {string} INVALID_PLUGIN_STATE - invalid plugin state
 * @property {string} COMPLETED_BY_PLUGIN_START_AT_REQUIRED - completedByPlugin.startAt is required
 */
const ERRORS = {
  ID_REQUIRED: 'id is required',
  PARAMS_REQUIRED: 'params are required',
  PAYMENT_OBJECT_REQUIRED: 'payment object is required',
  ORDER_ID_REQUIRED: 'orderId is required',
  ALREADY_EXISTS: (id) => `Payment id: ${id} already exists`,
  NO_DB: 'No database provided',
  DB_NOT_READY: 'Database is not ready',
  NO_MATCHING_PLUGINS: 'No plugins found',
  CLIENT_ID_REQUIRED: 'clientOrderId is required',
  COUNTERPARTY_REQUIRED: 'counterpartyURL is required',
  NOT_ALLOWED: 'Not allowed',
  NO_PAYMENT_FILE: 'No payment file found',
  INVALID_DIRECTION: 'Invalid payment direction',
  COMPLETED_BY_PLUGIN_REQUIRED: 'completedByPlugin is required',
  COMPLETED_BY_PLUGIN_NAME_REQUIRED: 'completedByPlugin.name is required',
  COMPLETED_BY_PLUGIN_STATE_REQUIRED: 'completedByPlugin.state is required',
  INVALID_PLUGIN_STATE: (state) => `Invalid plugin state ${state}`,
  COMPLETED_BY_PLUGIN_START_AT_REQUIRED: 'completedByPlugin.startAt is required'
}

/**
 * @typedef {Object} PaymentDirection
 * @property {string} IN - incoming payment
 * @property {string} OUT - outgoing payment
 */
const PAYMENT_DIRECTION = {
  IN: 'IN',
  OUT: 'OUT'
}

module.exports = {
  PaymentObject,
  PAYMENT_STATE,
  PLUGIN_STATE,
  ERRORS,
  PAYMENT_DIRECTION
}
