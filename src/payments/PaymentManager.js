const { PluginManager } = require('../plugins/PluginManager')

const { PaymentOrder } = require('./PaymentOrder')
const { PaymentSender } = require('./PaymentSender')
const { PaymentReceiver } = require('./PaymentReceiver')

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
   * @param {any} db - instance of Database class
   * @param {SlashtagsConnector} slashtagsConnector - instance of SlashtagsConnector class
   * @param {Function} notificationCallback - callback function for user notifications
   */
  // TODO: change config, instantiate db and slashtagsConnector inside the constructor if not passed
  constructor (config, db, slashtagsConnector, notificationCallback) {
    this.config = config
    this.db = db
    this.slashtagsConnector = slashtagsConnector
    this.pluginManager = new PluginManager(this.config)
    this.notificationCallback = notificationCallback

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
   * @returns {Promise<PaymentOrder>} - instance of Payment class
   */
  async createPaymentOrder (paymentObject) {
    const paymentParams = { ...paymentObject }
    if (!paymentParams.sendingPriority || paymentParams.sendingPriority.length === 0) {
      paymentParams.sendingPriority = this.config.sendingPriority
    }

    const paymentOrder = new PaymentOrder(paymentObject, this.db, this.slashtagsConnector)
    await paymentOrder.init()

    return paymentOrder.serialize()
  }

  /**
   * Send a payment
   * @param {string} id - paymentOrder id
   * @returns {Promise<void>} - payment id
   */
  async sendPayment (id) {
    const paymentSender = await this.getPaymentSender(id)

    await paymentSender.submit()
  }

  /**
   * Receive payments
   * @returns {Promise<string>}
   */
  // TODO: enable handling of multiple drives. First guess is to to create one receiver per drive
  async receivePayments () {
    await Promise.all(Object.keys(this.config.plugins).map(async (name) => {
      return await this.pluginManager.loadPlugin(name, this.slashtagsConnector)
    }))

    const paymentReceiver = new PaymentReceiver(
      this.db,
      this.pluginManager,
      this.slashtagsConnector,
      this.entryPointForPlugin.bind(this)
    )
    return await paymentReceiver.init()
  }

  /*
   * NOTE: things below right now are implemented as callback functions
   * but may alternatively be implemented as URLs for RPC APIs
   */

  /**
   * Entry point for plugins to send data to the payment manager
   * @param {Object} payload - payload object
   * @property {String} payload.pluginName - name of the plugin
   * @property {String} payload.paymentId - id of the payment
   * @property {String} payload.state - state of the payment
   * @property {String} payload.data - data to be sent to the payment manager
   * @returns {Promise<void>}
   */
  async entryPointForPlugin (payload) {
    if (payload.type === PAYLOAD_TYPE.PAYMENT_NEW) {
      await this.handleNewPayment(payload)
    } else if (payload.type === PAYLOAD_TYPE.PAYMENT_UPDATE) {
      await this.handlePaymentUpdate(payload)
    } else if (payload.type === PAYLOAD_TYPE.PAYMENT_ORDER_COMPLETED) {
      await this.userNotificationEndpoint(payload)
    } else if (payload.type === PAYLOAD_TYPE.READY_TO_RECEIVE) {
      // TODO: move to helper
      // FIXME: if amount was passed path will be private
      const path = `public/slashpay/${payload.pluginName}/slashpay.json`
      await this.slashtagsConnector.create(path, payload.data)
    } else {
      await this.userNotificationEndpoint(payload)
    }
  }

  /**
   * Handle new payment
   * @param {Object} payload - payload object
   * @returns {Promise<void>}
   */
  async handleNewPayment (payload) {
    const paymentReceiver = new PaymentReceiver(
      this.db,
      this.pluginManager,
      this.slashtagsConnector,
      this.userNotificationEndpoint.bind(this)
    )
    await paymentReceiver.handleNewPayment(payload, payload.amountWasSpecified)
  }

  /**
   * Handle payment update
   * @param {Object} payload - payload object
   * @returns {Promise<void>}
   */
  async handlePaymentUpdate (payload) {
    const paymentSender = await this.getPaymentSender(payload.orderId)
    await paymentSender.stateUpdateCallback(payload)

    await this.userNotificationEndpoint(payload)
  }

  /**
   * Entry point for users to send data to the payment manager which will be forwarded to plugin
   * @param {Object} data - data object
   * @param {String} data.paymentId - id of the related payment
   * @returns {Promise<void>}
   */
  async entryPointForUser (data) {
    const paymentSender = await this.getPaymentSender(data.orderId)

    // TOOD: consider adding requirements to the data format
    await paymentSender.updatePayment(data)
  }

  /**
   * Instantiate PaymentSender for order
   * @param {String} id - paymentOrder id
   * @returns {Promise<PaymentSender>} - instance of PaymentSender class
   */
  async getPaymentSender (id) {
    const paymentOrder = await PaymentOrder.find(id, this.db, this.slashtagsConnector)
    return new PaymentSender(
      paymentOrder,
      this.pluginManager,
      this.entryPointForPlugin.bind(this)
    )
  }

  /**
   * Entry point for plugin to send notification to the user
   * @param {Object} payment - payment object
   * @returns {Promise<void>}
   */
  async userNotificationEndpoint (payload) {
    this.notificationCallback(payload)
  }
}

/**
 * @typedef {Object} PayloadType
 * @property {String} PAYMENT_NEW - payment_new
 * @property {String} PAYMENT_UPDATE - payment_update
 * @property {String} PAYMENT_ORDER_COMPLETED - payment_order_completed
 * @property {String} READY_TO_RECEIVE - ready_to_receive
 */
const PAYLOAD_TYPE = {
  PAYMENT_NEW: 'payment_new',
  PAYMENT_UPDATE: 'payment_update',
  PAYMENT_ORDER_COMPLETED: 'payment_order_completed',
  READY_TO_RECEIVE: 'ready_to_receive'
}

module.exports = {
  PaymentManager,
  PAYLOAD_TYPE
}
