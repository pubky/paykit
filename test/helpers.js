const createTestnet = require('@hyperswarm/testnet')

const { orderParams } = require('./fixtures/paymentParams')

const { PaymentOrder } = require('../src/payments/PaymentOrder')
const { DB } = require('../src/DB')
const { SlashtagsConnector, SLASHPAY_PATH } = require('../src/slashtags')

module.exports = {
  getOneTimePaymentOrderEntities: async function getOneTimePaymentOrderEntities (t, initializeReceiver = false, opts = {}) {
    const db = new DB()
    await db.init()

    const testnet = await createTestnet(3, t)
    const receiver = new SlashtagsConnector(testnet)
    await receiver.init()
    const sender = new SlashtagsConnector(testnet)
    await sender.init()

    const params = {
      ...orderParams,
      counterpartyURL: receiver.getUrl(),
      ...opts
    }

    if (initializeReceiver) {
      await receiver.create(SLASHPAY_PATH, {
        paymentEndpoints: {
          p2sh: '/public/p2sh.json',
          lightning: '/public/lightning.json'
        }
      })
    }

    const paymentOrder = new PaymentOrder(params, db, sender)

    return {
      db,
      paymentOrder,
      receiver,
      sender
    }
  },

  sleep: async function sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
