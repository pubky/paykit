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
  constructor (pluginManager, payment, db, notificationCallback) {
    // TODO: validate input
    this.pluginManager = pluginManager
    this.payment = payment

    if (!this.payment.sendingPriority.length) {
      throw new Error('No plugins to send payment')
    }

    this.db = db
    this.notificationCallback = notificationCallback
  }

  /**
   * Submit payment to plugin
   * @method submit
   * @returns {Promise<void>}
   * @throws {Error} - if no plugins for making payment are available
   */
  async submit () {
    const pluginName = this.payment.sendingPriority.shift()
    if (!pluginName) {
      throw new Error('No plugins to send payment')
    }
    this.payment.processingPluging = pluginName
    await this.db.updatePayment(this.payment)

    // TODO: handle path instead of name
    const { plugin } = await this.pluginManager.loadPlugin(pluginName)

    await plugin.sendPayment(this.payment, this.stateUpdateCallback)
  }

  /**
   * Forward payment to plugin
   * @method forward
   * @param {String} pluginName
   * @param {PaymentData} paymentData
   * @returns {Promise<void>}
   */
  async forward (pluginName, paymentData) {
    // TODO: make sure that payment exists and in correct state

    const { plugin } = await this.pluginManager.loadPlugin(pluginName)

    await plugin.updatePayment(paymentData)
  }

  /**
   * Update payment state
   * @method stateUpdateCallback
   * @param {PaymentStateUpdate} update
   * @returns {Promise<void>}
   */
  async stateUpdateCallback (update) {
    await this.db.updatePayment(update)
    await this.notificationCallback(update)

    if (update.state === 'failed') {
      this.payment.processedPlugins.push(this.payment.processingPluging)
      this.payment.processingPluging = null
      try {
        await this.submit()
      } catch (e) {
        // failed to process by all plugins
        await this.notificationCallback(e)
      }
      return
    }

    if (update.state === 'success') {
      this.payment.sentByPluging = this.payment.processingPluging
      this.payment.processingPluging = null
    }
  }
}

module.exports = {
  PaymentSender
}
