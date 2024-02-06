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

class Paykit {
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

  async createPaymentOrder ({
    clientOrderId,
    counterpartyURL,
    memo = '',
    sendingPriority = this.config.slashpay.sendingPriority,
    amount,
    amountOpts = { currency: 'BTC', denomination: 'base' }
  }) {
    return await paymentManager.createPaymentOrder({
      clientOrderId,
      amount,
      counterpartyURL,
      memo,
      sendingPriority,
      ...amountOpts
    })
  }

  async sendPayment (id) {
    return this.paymentManager.sendPayment(id)
  }

  async createInvoice ({
    clientInvoiceId,
    amount,
    amountOpts = { currency: 'BTC', denomination: 'base' }
  }) {
    return this.paymentManager.createInvoice(id, amount, amountOpts)
  }

  async getIncomingPayments (params) {
    return await this.db.getIncomingPayments(params)
  }

  async getOutgoingPayments (params) {
    return await this.db.getOutgoingPayments(params)
  }

  // TODO: add more interface methods
}

module.exports = Paykit
