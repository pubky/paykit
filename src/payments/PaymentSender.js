const { ERRORS: ORDER_ERRORS } = require('./PaymentOrder')
/**
 * PaymentSender - class for processing outgoing payment orders
 * @class PaymentSender
 */
class PaymentSender {
  /**
   * Creates an instance of PaymentSender.
   * @constructor PaymentSender
   * @param {PaymentOrder} paymentOrder
   * @param {DB} db
   * @param {PluginManager} pluginManager
   * @param {Function} entryPointForPlugin
   */
  constructor (paymentOrder, pluginManager, entryPointForPlugin) {
    this.paymentOrder = paymentOrder
    this.pluginManager = pluginManager
    this.entryPointForPlugin = entryPointForPlugin
  }

  /**
   * Submit payment to plugin
   * @method submit
   * @returns {Promise<void>}
   * @throws {Error} - if no plugins for making payment are available
   */
  async submit () {
    const payment = await this.paymentOrder.process()
    const { plugin } = await this.getCurrentPlugin(payment)

    await plugin.pay(payment.serialize(), this.entryPointForPlugin)
  }

  /**
   * Update payment - forwards data to plugin
   * @method updatePayment
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async updatePayment (data) {
    const payment = await this.paymentOrder.getPaymentInProgress()
    const { plugin } = await this.getCurrentPlugin(payment)

    await plugin.updatePayment(data)
  }

  /**
   * Get plugin currently handling payment
   * @method getCurrentPlugin
   * @param {Payment} payment
   * @returns {Promise<Plugin>} plugin
   */
  async getCurrentPlugin (payment) {
    const currentPlugin = payment.getCurrentPlugin()

    if (!currentPlugin) throw new Error(ERRORS.NO_PLUGINS_AVAILABLE)

    const loaded = this.pluginManager.plugins[currentPlugin.name]
    if (loaded) {
      // XXX: this should never happen
      if (!loaded.active) throw new Error('Plugin is not active')

      return loaded
    } else {
      return await this.pluginManager.loadPlugin(currentPlugin.name)
    }
  }

  /**
   * Update payment state upon request of plugin
   * @method stateUpdateCallback
   * @param {PaymentStateUpdate} update (must contain pluginState)
   * @returns {Promise<void>}
   */
  async stateUpdateCallback (update) {
    const payment = this.paymentOrder.getPaymentInProgress()
    // XXX: this should never happen
    if (!payment) throw new Error('No payment in process')

    // TODO: implement properly but first decide what "properly" means
    payment.pluginUpdate = update
    await payment.update()
    await this.handlePluginState(payment)
  }

  /**
   * Handle plugin state
   * @method handlePluginState
   * @param {Payment} payment
   * @returns {Promise<void>}
   */
  async handlePluginState (payment) {
    // TODO: pluginStates should be conventional
    if (payment.pluginUpdate.pluginState === 'failed') {
      await this.handleFailure(payment)
    } else if (payment.pluginUpdate.pluginState === 'success') {
      await this.handleSuccess(payment)
    } else {
      // XXX: intermediate state which requires action from user
      await this.entryPointForPlugin(payment)
    }
  }

  /**
   * Handle payment failure
   * @method handleFailure
   * @param {Payment} payment
   * @returns {Promise<void>}
   */
  async handleFailure (payment) {
    await payment.failCurrentPlugin()
    try {
      await this.submit()
    } catch (e) {
      if (e.message === ERRORS.NO_PLUGINS_AVAILABLE) return await this.entryPointForPlugin(e)

      throw e
    }
  }

  /**
   * Handle payment success
   * @method handleSuccess
   * @param {Payment} payment
   * @returns {Promise<void>}
   */
  async handleSuccess (payment) {
    await payment.complete()
    // XXX: notification for micropayments will be too much
    await this.entryPointForPlugin(payment)

    try {
      await this.paymentOrder.complete()
      await this.entryPointForPlugin({
        type: 'payment_order_complete',
        data: this.paymentOrder
      })
    } catch (e) {
      if (ORDER_ERRORS.OUTSTANDING_PAYMENTS) {
        // RECURRING PAYMENT territory
        return
      }
      throw e
    }
  }
}

/**
 * @typedef {Object} ERRORS
 * @property {String} NO_PLUGINS_AVAILABLE
 */
const ERRORS = {
  NO_PLUGINS_AVAILABLE: 'No plugins available for making payment'
}

module.exports = {
  PaymentSender
}
