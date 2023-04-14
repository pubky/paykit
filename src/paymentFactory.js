const { Payment } = require('./payment')

class PaymentFactory {
  constructor (db) {
    this.db = db
  }

  async getOrCreate (paymentObject) {
    const payment = await this.db.getPayment(paymentObject.externalId)
    if (payment) {
      return payment
    }

    return await this.createNewPayment(paymentObject)
  }

  async createNewPayment(paymentObject, sendingPriority) {
    const payment = new Payment(paymentObject)
    await payment.init(sendingPriority)

    await this.db.savePayment(payment)

    return payment
  }
}

module.exports = {
  PaymentFactory,
}
