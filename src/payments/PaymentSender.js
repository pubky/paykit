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
   * @param {Function} notificationCallback
   */
  constructor (paymentOrder, pluginManager, notificationCallback) {
    this.paymentOrder = paymentOrder
    this.pluginManager = pluginManager
    this.notificationCallback = notificationCallback
  }

  /**
   * Submit payment to plugin
   * @method submit
   * @returns {Promise<void>}
   * @throws {Error} - if no plugins for making payment are available
   */
  async submit () {
    const payment = await this.paymentOrder.process()
    const currentPlugin = payment.internalState.currentPlugin

    if (!currentPlugin) throw new Error(ERRORS.NO_PLUGINS_AVAILABLE)

    let plugin
    const loaded = this.pluginManager.plugins[currentPlugin.name]
    if (loaded) {
      // XXX: this should never happen
      if (!loaded.isActive) throw new Error('Plugin is not active')

      plugin = loaded.plugin
    } else {
      const loaded = await this.pluginManager.loadPlugin(currentPlugin.name)
      plugin = loaded.plugin
    }

    await plugin.pay(payment.serialize(), this.stateUpdateCallback)
  }

  // TODO: make it static method so it will instantiate PaymentSender, load PaymentOrder and corresponding Payment
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
      await this.notificationCallback(payment)
    }
  }

  /**
   * Handle payment failure
   * @method handleFailure
   * @param {Payment} payment
   * @returns {Promise<void>}
   */
  async handleFailure (payment) {
    await payment.internalState.failCurrentPlugin()
    try {
      await this.submit()
    } catch (e) {
      if (e.message === ERRORS.NO_PLUGINS_AVAILABLE) return await this.notificationCallback(e)

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
    await this.notificationCallback(payment)

    try {
      await this.paymentOrder.complete()
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
