class PaymentSender {
  constructor(pluginManager, payment, db) {
    this.pluginManager = pluginManager
    this.payment = payment

    if (!this.payment.sendingPriority.length) {
      throw new Error('No plugins to send payment')
    }

    this.db = db
  }

  async send() {
    const pluginName = this.payment.sendingPriority.shift()
    this.payment.sentWith.push(pluginName)
    await this.db.updatePayment(this.payment)

    const { plugin } = this.pluginManager.loadPlugin(pluginName)

    // pass db to update payment plugin state
    // OR consider passing callback for state update alternatively
    // AND/OR consider passing callback for update notifications
    await plugin.sendPayment(this.payment)
  }
}
