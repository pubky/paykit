const { PaymentManager } = require('./src/payments/PaymentManager')
const { DB } = require('./src/DB')
const { SlashtagsConnector } = require('./src/slashtags')

const defaultConfig = {
  db: {
    // TODO:
  },
  plugins: {
    // TODO:
  },
  sendingPriority: [
    // TODO:
  ],
  slashtags: {
    // TODO:
  }
}

class Slashpay {
  constructor (notificationCallback, config) {
    this.config = { ...defaultConfig, ...config }
    this.db = new DB(this.config.db)
    this.slashtagsConnector = new SlashtagsConnector(this.config.slashtags)
    this.paymentManager = new PaymentManager(this.config, this.db, this.slashtagsConnector)
  }

  async init () {
    await this.paymentManager.init()
  }

  async createPaymentOrder (paymentObject) {
    return this.paymentManager.createPaymentOrder(paymentObject)
  }

  async sendPayment (id) {
    return this.paymentManager.sendPayment(id)
  }

  async getPayments (params) {
    // TODO: implement db call
  }

  // TODO: add more interface methods
}

module.exports = Slashpay
