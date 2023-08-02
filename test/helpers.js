const createTestnet = require('@hyperswarm/testnet')

const { orderParams } = require('./fixtures/paymentParams')

const { PaymentOrder } = require('../src/payments/PaymentOrder')
const { DB } = require('../src/DB')
const { SlashtagsConnector, SLASHPAY_PATH } = require('../src/slashtags')

module.exports = {
  getOneTimePaymentOrderEntities: async function getOneTimePaymentOrderEntities (t, initializeReceiver = false, createOrder = true, opts = {}) {
    const db = new DB({ name: 'test', path: './test_db' })
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
          p2tr: '/public/p2tr.json'
        }
      })

      await receiver.create('/public/p2sh.json', { p2sh: 'test.p2sh' })
      await receiver.create('/public/p2tr.json', { p2tr: 'test.p2tr' })
    }

    let paymentOrder
    if (createOrder) {
      paymentOrder = new PaymentOrder(params, db, sender)
    }

    return {
      db,
      paymentOrder,
      receiver,
      sender
    }
  },

  sleep: async function sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  dropTables: async function dropTables (db) {
    const statement = 'DROP TABLE IF EXISTS payments; DROP TABLE IF EXISTS orders;'
    return new Promise((resolve, reject) => {
      db.db.sqlite.exec(statement, (err, res) => {
        if (err) return reject(err)
        return resolve(res)
      })
    })
  }
}
