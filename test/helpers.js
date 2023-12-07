const { orderParams } = require('./fixtures/paymentParams')
const os = require('os')

const { PaymentOrder } = require('../src/payments/PaymentOrder')
const { DB } = require('../src/DB')
const { SlashtagsConnector, SLASHPAY_PATH } = require('../src/slashtags')

const { Relay } = require('@synonymdev/web-relay')

module.exports = {
  getOneTimePaymentOrderEntities,
  sleep,
  dropTables,
  tmpdir
}

function tmpdir () {
  return os.tmpdir() + Math.random().toString(16).slice(2)
}

async function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getOneTimePaymentOrderEntities (t, initializeReceiver = false, createOrder = true, opts = {}) {
  const db = new DB({ name: 'test', path: './test_db' })
  await db.init()

  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const receiver = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  const sender = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  const params = {
    ...orderParams,
    counterpartyURL: await receiver.getUrl(),
    ...opts
  }

  if (initializeReceiver) {
    const p2sh = await receiver.create('/public/p2sh.json', { p2sh: 'test.p2sh' }, { awaitRelaySync: true })
    const p2tr = await receiver.create('/public/p2tr.json', { p2tr: 'test.p2tr' }, { awaitRelaySync: true })

    await receiver.create(SLASHPAY_PATH, {
      paymentEndpoints: {
        p2sh,
        p2tr
      }
    }, { awaitRelaySync: true })
  }

  let paymentOrder
  if (createOrder) {
    paymentOrder = new PaymentOrder(params, db, sender)
  }


  return {
    db,
    paymentOrder,
    receiver,
    sender,
    relay
  }
}

async function dropTables (db) {
  const statement = 'DROP TABLE IF EXISTS payments; DROP TABLE IF EXISTS orders;'
  return new Promise((resolve, reject) => {
    db.db.sqlite.exec(statement, (err, res) => {
      if (err) return reject(err)
      return resolve(res)
    })
  })
}
