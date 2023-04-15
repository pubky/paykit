/**
 * Payment class
 * @class Payment - represents a payment
 */
class Payment {
  /**
   * @constructor
   * @param {PaymentParams} paymentParams - payment parameters
   * @property {string} id - payment id
   * @property {internalState} internalState - internal state of the payment
   * @property {string[]} sentWith - list of plugins used to send the payment
   * @property {string} target - target of the payment
   * @property {string} clientPaymentId - client payment id
   * @property {string} amount - amount of the payment
   * @property {string} currency - currency of the payment, default is BTC
   * @property {string} denomination - denomination of the payment, default is BASE
   * @property {boolean} ready - true if the payment is ready to be sent
   */
  constructor (paymentParams) {
    Payment.validatePaymentObject(paymentParams)
    this.id = Payment.generateId()

    this.internalState = PAYMENT_STATE.INITIAL
    this.sentWith = []

    // XXX this is needed only to check what plugins are available on the target
    this.target = paymentParams.target

    this.clientPaymentId = paymentParams.clientPaymentId
    this.amount = paymentParams.amount
    this.currency = paymentParams.currency || 'BTC'
    this.denomination = paymentParams.denomination || 'BASE' // satoshi
    this.sentWith = []

    this.ready = false
  }

  /**
   * Generate a random id
   * @returns {string} - random id
   */
  static generateId () {
    // uuid is not available with runtime because of the crypto module
    // TODO: figure out how to use it
    return 'totally-random-id'
  }

  /**
   * Validate payment object
   * @param {PaymentParams} paymentParams - payment parameters
   * @throws {Error} - if paymentParams is invalid
   * @returns {void}
   */
  static validatePaymentObject (paymentParams) {
    if (!paymentParams.clientPaymentId) throw new Error(ERROR.CLIENT_ID_REQUIRED)
    if (!paymentParams.amount) throw new Error(ERROR.AMOUNT_REQUIRED)
    // if (!paymentParams.currency) throw new Error(ERROR.CURRENCY_REQUIRED)
    // if (!paymentParams.denomination) throw new Error(ERROR.DENOMINATION_REQUIRED)
    if (!paymentParams.target) throw new Error(ERROR.TARGET_REQUIRED)
  }

  /**
   * Initialize payment
   * @param {RemoteStorage} remoteStorage - remote storage
   * @param {string[]} sendingPriority - list of plugins to use to send the payment
   * @throws {Error} - if no plugins are available
   * @returns {Promise<void>}
   */
  async init (remoteStorage, sendingPriority) {
    if (!remoteStorage) throw new Error(ERROR.NO_REMOTE_STORAGE)
    if (!sendingPriority) throw new Error(ERROR.NO_SENDING_PRIORITY)
    // XXX is it a place to do this or should it be done by each plugin?
    await remoteStorage.init(this.target)

    const paymentFile = await remoteStorage.getPaymentFile()
    this.sendingPriority = Object.keys(paymentFile.paymentEndpoints)
      .filter(endpoint => sendingPriority.includes(endpoint))

    if (!this.sendingPriority.length) throw new Error(ERROR.NO_PLUGINS)

    this.ready = true
  }
}

/**
 * @typedef {Object} PaymentParams
 * @property {string} clientPaymentId - client payment id
 * @property {string} amount - amount of the payment
 * @property {string} currency - currency of the payment, default is BTC
 * @property {string} [denomination] - denomination of the payment, default is BASE
 * @property {string} [target] - target of the payment
 */

/**
 * @typedef {Object} Error
 * @property {string} NO_PLUGINS - no plugins found
 * @property {string} CLIENT_ID_REQUIRED - clientPaymentId is required
 * @property {string} AMOUNT_REQUIRED - amount is required
 * // @property {string} CURRENCY_REQUIRED - currency is required
 * // @property {string} DENOMINATION_REQUIRED - denomination is required
 * @property {string} TARGET_REQUIRED - target is required
 * @property {string} NO_REMOTE_STORAGE - no remote storage provided
 */
const ERROR = {
  NO_PLUGINS: 'No plugins found',
  CLIENT_ID_REQUIRED: 'clientPaymentId is required',
  AMOUNT_REQUIRED: 'amount is required',
  // CURRENCY_REQUIRED: 'currency is required',
  // DENOMINATION_REQUIRED: 'denomination is required',
  TARGET_REQUIRED: 'target is required',
  NO_REMOTE_STORAGE: 'No remote storage provided',
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
