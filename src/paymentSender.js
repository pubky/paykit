class PaymentSender {
  constructor(pluginManager, payment, db, notificationCallback) {
    this.pluginManager = pluginManager
    this.payment = payment

    if (!this.payment.sendingPriority.length) {
      throw new Error('No plugins to send payment')
    }

    this.db = db
    this.notificationCallback = notificationCallback
  }

  async submit() {
    const pluginName = this.payment.sendingPriority.shift()
    if (!pluginName) {
      throw new Error('No plugins to send payment')
    }
    this.payment.processingPluging = pluginName
    await this.db.updatePayment(this.payment)

    const { plugin } = await this.pluginManager.loadPlugin(pluginName)

    await plugin.sendPayment(this.payment, this.stateUpdateCallback)
  }

  async forward(pluginName, paymentData) {
    const { plugin } = await this.pluginManager.loadPlugin(pluginName)

    await plugin.updatePayment(paymentData)
  }

  async stateUpdateCallback(update) {
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
      return
    }
  }
}
