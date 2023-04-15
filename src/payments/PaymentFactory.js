const { Payment } = require('./Payment')

// XXX consider merging with payment
/**
 * PaymentFactory class
 * @class PaymentFactory
 */
class PaymentFactory {
  /**
   * @constructor PaymentFactory
   * @param {DB} db
   * @param {PaymentConfig} paymentConfig
   */
  constructor (db, paymentConfig) {
    this.db = db
    this.paymentConfig = paymentConfig
  }

  /**
   * @method getOrCreatePayment
   * @param {PaymentParams} paymentParams
   * @param {RemoteStorage} remoteStorage
   * @param {[SendingPriority]} sendingPriority
   * @returns {Promise<Payment>}
   * @throws {Error} - if no plugins for making payment are available
   */
  async getOrCreatePayment (
    paymentParams,
    remoteStorage,
    sendingPriority = this.paymentConfig.sendingPriority
  ) {
    const payment = await this.db.getPayment(paymentParams.externalId)
    if (payment) {
      return payment
    }

    return await this.createNewPayment(paymentParams, remoteStorage, sendingPriority)
  }

  /**
   * @method createNewPayment
   * @param {PaymentParams} paymentParams
   * @param {RemoteStorage} remoteStorage
   * @param {[SendingPriority]} sendingPriority
   * @returns {Promise<Payment>}
   * @throws {Error} - if no plugins for making payment are available
   */
  async createNewPayment (
    paymentParams,
    remoteStorage, // instance of a remote storage (e.g. HyperDrive)
    sendingPriority = this.paymentConfig.sendingPriority
  ) {
    if (!remoteStorage) throw new Error(ERROR.MISSING_STORAGE)
    const payment = new Payment(paymentParams)
    await payment.init(remoteStorage, sendingPriority)

    await this.db.savePayment(payment)

    return payment
  }
}

const ERROR = {
  MISSING_STORAGE: 'Missing storage'
}

module.exports = {
  PaymentFactory,
  ERROR
}
