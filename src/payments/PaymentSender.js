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
  constructor (paymentOrder, db, pluginManager, notificationCallback) {
    this.paymentOrder = paymentOrder
    this.db = db
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

    if (!payment.processingPlugin) {
      throw new Error('No plugins available for making payment')
    }

    // TODO: also check if plugin is enabled
    let plugin
    const loaded = this.pluginManager.plugins[payment.processingPlugin]
    if (loaded) {
      plugin = loaded.plugin
    } else {
      const loaded = await this.pluginManager.loadPlugin(payment.processingPlugin)
      plugin = loaded.plugin
    }

    await plugin.pay(payment.serialize(), this.stateUpdateCallback)
  }

  /**
   * Update payment state upon request of plugin
   * @method stateUpdateCallback
   * @param {PaymentStateUpdate} update (must contain pluginState)
   * @returns {Promise<void>}
   */
  async stateUpdateCallback (update) {
    // TODO verify that it is correct payment
    const payment = this.paymentOrder.payments[0]
    // TODO: update itself as well
    await payment.update(update)
    payment.pluginState = update.pluginState

    await this.notificationCallback(update)

    // TODO: implement properly
    if (update.pluginState === 'failed') {
      try {
        await this.submit()
      } catch (e) {
        // failed to process by all plugins
        await this.notificationCallback(e)
      } finally {
        return
      }
    } else if (update.pluginState === 'success') {
      await payment.complete()
    } else {
      // temporal plugin states
    }
  }
}

module.exports = {
  PaymentSender
}
