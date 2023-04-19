const { Payment } = require('./Payment')
/**
 * PaymentSender
 * @class PaymentSender
 */
class PaymentSender {
  /**
   * Creates an instance of PaymentSender.
   * @constructor PaymentSender
   * @param {PluginManager} pluginManager
   * @param {Payment} payment
   * @param {DB} db
   * @param {Function} notificationCallback
   */
  constructor (payment, db, pluginManager, notificationCallback) {
    this.payment = payment

    if (!this.payment.sendingPriority.length) {
      throw new Error('No plugins to send payment')
    }

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
    const { processingPluging: pluginName } = await this.payment.process()
    const { plugin } = await this.pluginManager.loadPlugin(pluginName)
    await plugin.pay(this.payment.serialize(), this.stateUpdateCallback)
  }

  /**
   * Forward payment to plugin
   * @method forward
   * @param {String} pluginName
   * @param {PaymentData} paymentData
   * @returns {Promise<void>}
   */
  async forward (pluginName) {
    const { plugin } = await this.pluginManager.loadPlugin(pluginName)

    await plugin.updatePayment(this.payment.serialize())
  }

  /**
   * Update payment state
   * @method stateUpdateCallback
   * @param {PaymentStateUpdate} update
   * @returns {Promise<void>}
   */
  async stateUpdateCallback (update) {
    const payment = await Payment.find(update.id)
    await payment.update(update)

    await this.notificationCallback(update)

    if (update.state === 'failed') {
      try {
        await this.submit()
      } catch (e) {
        // failed to process by all plugins
        await this.notificationCallback(e)
      } finally {
        return
      }
    } else if (update.state === 'success') {
      await this.payment.complete()
    } else {
      // temporal plugin states
    }
  }
}

module.exports = {
  PaymentSender
}
