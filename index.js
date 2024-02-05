const { PaymentManager } = require('./src/payments/PaymentManager')
const { DB } = require('./src/DB')
const { SlashtagsConnector } = require('./src/slashtags')
const path = require('path')

const defaultConfig = {
  db: {
    name: 'paykit',
    path: './paykit_db'
  },
  slashtags: {
    relay: 'http://localhost:3000'
  },
  slashpay: {
    sendingPriority: ['bolt11', 'onchain'],
    plugins: {
      bolt11: require('./plugins/btc-l1-l2-lnd/bolt11.js'),
      onchain: require('./plugins/btc-l1-l2-lnd/onchain.js'),
    },
    bolt11: {
      CERT: ''
      MACAROON: '',
      SOCKET: '',
    },
    onchain: {
      CERT: ''
      MACAROON: '',
      SOCKET: '',
    }
  }
}

class PayKit {
  constructor (notificationCallback, config) {
    this.config = { ...defaultConfig, ...config }
    this.db = new DB(this.config.db)
    this.paymentManager = new PaymentManager(this.config, this.db)
    this.notificationCallback = notificationCallback
  }

  async init (receivePayments = true) {
    await this.paymentManager.init()
    if (receivePayments) {
      const myUrl = await this.paymentManager.receivePayments()
      this.notificationCallback(myUrl)
    }
  }

  async createPaymentOrder ({ clientOrderId, amount, counterpartyURL }) {
    return await paymentManager.createPaymentOrder({ clientOrderId, amount, counterpartyURL })
  }

  async sendPayment (id) {
    return this.paymentManager.sendPayment(id)
  }

  async createInvoice (id, amount) {
    return this.paymentManager.createInvoice(id, amount)
  }

  async getIncomingPayments (params) {
    return await this.db.getIncomingPayments(params)
  }

  async getOutgoingPayments (params) {
    return await this.db.getOutgoingPayments(params)
  }

  // TODO: add more interface methods
}

module.exports = PayKit
