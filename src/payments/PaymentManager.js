const { PluginManager } = require('../pluginManager')

const { Payment } = require('./Payment')
const { PaymentSender } = require('./PaymentSender')
const { PaymentReceiver } = require('./PaymentReceiver')

const { SlashtagsAccessObject } = require('../SlashtagsAccessObject')

/**
 * @class PaymentManager - main class for payment management. Use this class to create, submit, receive and interact
 * with payments. It an implementation of a Facade Pattern. It hides all the complexity of the payment process.
 *
 * @param {Object} config - configuration object
 * @param {Object} config.db - configuration object for database
 * @param {String} config.db.path - path to the database
 * @property {Object} config - configuration object
 * @property {Database} db - instance of Database class
 * @property {Boolean} ready - flag to indicate if the payment manager is ready
 */
class PaymentManager {
  /**
   * @constructor
   * @param {Object} config - configuration object
   */
  constructor (config, db) {
    this.config = config
    this.db = db
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
   * Create a payment
   * @param {Object} paymentObject - payment object
   * @returns {Promise<Payment>} - instance of Payment class
   */
  async createPayment (paymentObject) {
    const payment = await Payment.createPayment(paymentObject, {}, { db: this.db })
    return payment
  }

  /**
   * Send a payment
   * @param {string} id - payment id
   * @returns {Promise<String>} - payment id
   */
  async sendPayment (id) {
    const pluginManager = new PluginManager(this.config)
    const payment = await Payment.find(paymentObject.id, {}, { db: this.db })

    const paymentSender = new PaymentSender(payment, this.db, pluginManager, this.entryPointForPlugin)

    await paymentSender.submit()
    return payment.id
  }

  /**
   * Receive payments
   * @returns {Promise<void>}
   */
  async receivePayments () {
    const storage = new SlashtagsAccessObject()
    const pluginManager = new PluginManager(this.config)
    await this.config.plugins.forEach(async ({ name }) => {
      await pluginManager.loadPlugin(name)
    })

    const paymentReceiver = new PaymentReceiver(this.db, pluginManager, storage, this.entryPointForPlugin)
    await paymentReceiver.init()
  }

  /*
   * NOTE: things below right now are implemented as callback functions
   * but may alternatively be implemented as URLs for RPC APIs
   */

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
      return await this.askClient(payload)
    }

    if (payload.state === 'newPayment') {
      const payment = new Payment(data, {}, { db: this.db })
      await payment.save()
    }
  }

  /**
   * Entry point for users to send data to the payment manager which will be forwarded to plugin
   * @param {Object} data - data object
   * @param {String} data.paymentId - id of the related payment
   * @returns {Promise<void>}
   */
  async entryPointForUser (data) {
    const pluginManager = new PluginManager(this.config)
    const payment = await Payment.find(data.id, this.db)

    const paymentSender = new PaymentSender(payment, this.db, pluginManager, this.entryPointForPlugin)
    await paymentSender.forward(pluginManager, data.pluginName)
  }

  /**
   * Entry point for plugin to send notification to the user
   * @param {Object} payment - payment object
   * @returns {Promise<void>}
   */
  async userNotificationEndpoint (payment) {
    console.log('askClient', payment)
  }
}

module.exports = {
  PaymentManager
}
