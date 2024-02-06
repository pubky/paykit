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
      CERT: '',
      MACAROON: '',
      SOCKET: '',
    },
    onchain: {
      CERT: '',
      MACAROON: '',
      SOCKET: '',
    }
  }
}

class Paykit {
  constructor ({ notificationCallback, config }) {
    this.config = { ...defaultConfig, ...config }
    this.notificationCallback = notificationCallback
    this.paymentManager = new PaymentManager({ config: this.config, notificationCallback: this.notificationCallback })
  }

  async init (receivePayments = false) {
    await this.paymentManager.init()
    if (receivePayments) {
      await this.receivePayments()
    }
  }

  async receivePayments () {
    return await this.paymentManager.receivePayments()
  }


  async createPaymentOrder ({
    clientOrderId,
    counterpartyURL,
    memo = '',
    sendingPriority = this.config.slashpay.sendingPriority,
    amount,
    amountOpts = { currency: 'BTC', denomination: 'BASE' }
  }) {
    return await this.paymentManager.createPaymentOrder({
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
    amountOpts = { currency: 'BTC', denomination: 'BASE' }
  }) {
    return this.paymentManager.createInvoice(clientInvoiceId, amount, amountOpts)
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
