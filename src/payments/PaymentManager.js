const Database = require('../db/database')
const PluginManager = require('./pluginManager')
const PaymentFactory = require('./paymentFactory')
const PaymentSender = require('./paymentSender')
const PaymentReceiver = require('./paymentReceiver')

/**
 * @class PaymentManager - main class for payment management. Use this class to create, submit, receive and interact
 * with payments. It an implementation of a Facade Pattern. It hides all the complexity of the payment process.
 *
 * @param {Object} config - configuration object
 * @param {Object} config.db - configuration object for database
 * @param {String} config.db.path - path to the database
 * @property {PluginManager} pluginManager - instance of PluginManager class
 * @property {Object} config - configuration object
 * @property {Database} db - instance of Database class
 * @property {Boolean} ready - flag to indicate if the payment manager is ready
 */
class PaymentManager {
  /**
   * @constructor
   * @param {Object} config - configuration object
   */
  constructor (config) {
    this.pluginManager = new PluginManager()
    this.config = config
    this.db = new Database(config.db)
    this.ready = false
  }

  /**
   * Initialize the payment manager
   * @returns {Promise<void>}
   */
  async init () {
    await this.db.init()
    this.ready = true
  }

  /**
   * Send a payment
   * @param {Object} paymentObject - payment object
   * @returns {Promise<String>} - payment id
   */
  async sendPayment (paymentObject) {
    const paymentFactory = new PaymentFactory(this.db)
    const payment = await paymentFactory.getOrCreate(paymentObject)

    const paymentSender = new PaymentSender(this.pluginManager, payment, this.db, this.entryPointForPlugin)

    await paymentSender.submit()
    return payment.id
  }

  /**
   * Receive payments
   * @returns {Promise<void>}
   */
  async receivePayments () {
    const paymentReceiver = new PaymentReceiver(this.pluginManager, this.db, this.entryPointForPlugin)

    await paymentReceiver.init()
  }

  /**
   * Entry point for plugins to send data to the payment manager
   * @param {Object} payload - payload object
   * @param {String} payload.pluginName - name of the plugin
   * @param {String} payload.paymentId - id of the payment
   * @param {String} payload.state - state of the payment
   * @param {String} payload.data - data to be sent to the payment manager
   * @returns {Promise<void>}
   */
  async entryPointForPlugin (payload) {
    if (payload.state === 'waitingForClient') {
      this.askClient(payload)
      return
    }

    if (payload.state === 'newPayment') {
      this.db.createIncomingPayment(payload)
    }
  }

  /**
   * Entry point for users to send data to the payment manager
   * @param {Object} data - data object
   * @param {String} data.paymentId - id of the related payment
   * @returns {Promise<void>}
   */
  async entryPointForUser (data) {
    const paymentFactory = new PaymentFactory(this.db)
    const payment = await paymentFactory.getOrCreate(data)

    const paymentSender = new PaymentSender(this.pluginManager, payment, this.db, this.entryPointForPlugin)
    await paymentSender.forward(data)
  }

  /**
   * Ask the client for data
   * @param {Object} payment - payment object
   * @returns {Promise<void>}
   */
  async askClient (payment) {
    console.log('askClient', payment)
  }
}

exports.PaymentManager = PaymentManager
