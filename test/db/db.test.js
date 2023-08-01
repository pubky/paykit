const { test } = require('brittle')
const { v4: uuidv4 } = require('uuid')

const { DB, ERROR } = require('../../src/DB/index.js')

async function dropTables (db) {
  const statement = `DROP TABLE IF EXISTS payments; DROP TABLE IF EXISTS orders;`
  return new Promise((resolve, reject) => {
    db.db.sqlite.exec(statement, (err, res) => {
      if (err) return reject(err)
      return resolve(res)
    })
  })
}

test('cosntructor', async (t) => {
  const db = new DB({ name: 'test', path: './test_db' })

  t.ok(db.db)
  t.is(db.ready, false)
})

test('init', async (t) => {
  const db = new DB({ name: 'test', path: './test_db' })

  await db.init()

  t.is(db.ready, true)
  const statement = `SELECT * FROM sqlite_schema WHERE type ='table' AND name NOT LIKE 'sqlite_%';`

  const res = await (new Promise((resolve, reject) => {
    db.db.sqlite.all(statement, (err, res) => {
      if (err) return reject(err)
      return resolve(res)
    })
  }))

  t.is(res.length, 2)
  t.is(res.find((r) => r.name === 'payments').name, 'payments')
  t.is(res.find((r) => r.name === 'orders').name, 'orders')

  await t.teardown(async () => {
    await dropTables(db)
  })
})


test('db.savePayment', async (t) => {
  const payment = {
    id: uuidv4(),
    orderId: uuidv4(),
    clientOrderId: uuidv4(),
    counterpartyURL: 'slash:XXXXXXX',
    memo: 'test memo',
    sendingPriority: [ 'p2sh', 'p2tr' ],
    createdAt: Date.now() - 100000,
    executeAt: Date.now() + 100000,
    direction: 'OUT',
    amount: '100',
    currency: 'BTC',
    denomination: 'BASE',
    internalState: 'pending',
    pendingPlugins: [ 'p2sh' ],
    triedPlugins: [
      {
        name: 'p2tr',
        startAt: Date.now() - 1000,
        state: 'failed',
        endAt: Date.now() - 100
      }
    ],
    currentPlugin: {},
    completedByPlugin: {}
  }

  const db = new DB({ name: 'test', path: './test_db' })

  await db.init()

  await db.savePayment(payment)

  const statement = `SELECT * FROM payments;`

  const res = await (new Promise((resolve, reject) => {
    db.db.sqlite.all(statement, (err, res) => {
      if (err) return reject(err)
      return resolve(res)
    })
  }))

  t.is(res.length, 1)
  const savedPayment = res[0]

  t.is(savedPayment.id, payment.id)
  t.is(savedPayment.orderId, payment.orderId)
  t.is(savedPayment.clientOrderId, payment.clientOrderId)
  t.is(savedPayment.counterpartyURL, payment.counterpartyURL)
  t.is(savedPayment.memo, payment.memo)
  t.is(savedPayment.sendingPriority, JSON.stringify(payment.sendingPriority))
  t.is(savedPayment.amount, payment.amount)
  t.is(savedPayment.denomination, payment.denomination)
  t.is(savedPayment.currency, payment.currency)
  t.is(savedPayment.internalState, payment.internalState)
  t.is(savedPayment.pendingPlugins, JSON.stringify(payment.pendingPlugins))
  t.is(savedPayment.triedPlugins, JSON.stringify(payment.triedPlugins))
  t.is(savedPayment.currentPlugin, JSON.stringify(payment.currentPlugin))
  t.is(savedPayment.completedByPlugin, JSON.stringify(payment.completedByPlugin))
  t.is(savedPayment.direction, payment.direction)
  t.is(savedPayment.createdAt, payment.createdAt)
  t.is(savedPayment.executeAt, payment.executeAt)

  await t.teardown(async () => {
    await dropTables(db)
  })
})
