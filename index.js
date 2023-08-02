const { PaymentManager } = require('./src/payments/PaymentManager')
const { DB } = require('./src/DB')
const { SlashtagsConnector } = require('./src/slashtags')
const path = require('path')

const defaultConfig = {
  db: { },
  plugins: {
    bolt11: path.resolve(__dirname, './plugins/btc-l1-l2-lnd/bolt11.js'),
    onchain: path.resolve(__dirname, './plugins/btc-l1-l2-lnd/onchain.js')
  },
  sendingPriority: [
    'bolt11',
    'onchain'
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
