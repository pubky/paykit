const { Payment } = require('./payment')


const ERRORS = {
  INVALID_PAYMENT_OBJECT: 'Invalid payment object',
  FAILED_TO_SAVE_PAYMENT: (id) => `Failed to save payment ${id}`,
  FAILED_TO_UPDATE_PAYMENT: (id) => `Failed to update payment ${id}`,
  INVALID_PAYMENT_UPDATE: 'Invalid payment update object',
}

class PaymentFactory {
  constructor (db) {
    this.db = db
  }

  async getOrCreate (paymentObject) {
    const payment = await this.db.getPayment(paymentObject.externalId)
    if (payment) {
      return {
        payment,
        storage: this.db,
      }
    }

    return await this.createNewPayment(paymentObject)
  }

  async createNewPayment(paymentObject, sendingPriority) {
    const payment = new Payment(paymentObject)
    await payment.init(sendingPriority)

    await this.db.savePayment(payment)

    return {
      payment,
      storage: this.db,
    }
  }
}
