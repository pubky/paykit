const { Storage } = require('./storage')
/**
 * Generate payment id
 * @returns {string} - payment id
 */
function paymentId () {
  return uuid()
}

const PAYMENT_STATE = {
  INITIAL: 'initial',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled',
}

class Payment {
  constructor(paymentObject) {
    this.id = paymentId()

    this.internalState = PAYMENT_STATE.INITIAL
    this.sentWith = []

    this.target = paymentObject.target

    // TODO: validate all
    this.clientId = paymentObject.clientId
    this.amount = paymentObject.amount
    this.currency = paymentObject.currency
    this.denomination = paymentObject.denomination
  }

  async init(sendingPriority) {
    const storage = new Storage(this.target)
    await storage.init()

    const paymentFile = await storage.getPaymentFile()
    this.sendingPriority = paymentFile
      .paymentEndpoints
      .filter(endpoint => sendingPriority.includes(endpoint))

    if (!this.sendingPriority.length) {
      throw new Error('No plugins to send payment')
    }
  }
}

/**
 * Payment Class
 * @class Payment
 * @constructor
 * @param {object} options - options for the payment
 * @property {string} clientId - external id of the payment
 * @property {string} internalId - destination account of the payment
 * @param {Storage} storage - storage object for the payment persistence
 *
 * @classdesc Payment class
 * @property {string} clientId - external id of the payment
 * @property {string} internalId - destination account of the payment
 * @property {string} amount - amount of the payment
 * @property {string} currency - currency of the payment
 * @property {PaymentDenomination} denomination - denomination of the payment
 *
 * @property {PAYMENT_STATE} internalState - internal state of the payment
 * @property {[string]} pluginState - plugin state of the payment
 * @property {[string]} networkState - network state of the payment
 */

/**
 * Payment Object
 * @typedef {Object} PaymentObject
 * @property {string} clientId - external id of the payment
 * @property {string} amount - amount of the payment
 * @property {string} currency - currency of the payment
 * @property {PaymentDenomination} denomination - denomination of the payment
 * @property {PAYMENT_STATE} internalState - internal state of the payment
 * @property {target} - url of receiver
 */

/**
 * PaymentDenomination
 * @typedef {string} PaymentDenomination
 * @enum {string} - Denomination of the payment
 * @property {string} MAIN - main denomination
 * @property {string} BASE - base denomination
 */

/**
 * Payment State
 * @typedef {Object} PaymentState
 * @property {string} INITIAL - payment received by paymentManager
 * @property {string} IN_PROGRESS - payment state defined by plugin
 * @property {string} COMPLETED - payment completed
 * @property {string} FAILED - payment failed
 * @property {string} CANCELED - payment canceled
 */


module.exports = { Payment, PAYMENT_STATE }
