const { Sqlite } = require('./Sqlite.js')

const ERROR = {
  NOT_READY: 'DB is not ready'
}

class DB {
  constructor (config) {
    this.db = new Sqlite(config)
    this.ready = false
  }

  async init () {
      // amount:
      //  - amount TEXT NOT NULL
      //  - currency TEXT NOT NULL
      //  - denomination TEXT NOT NULL
      // internalState
      //   - internalState TEXT NOT NULL
      //   - pendingPlugins TEXT NOT NULL
      //   - *triedPlugins TEXT NOT NULL
      //     - name text not null
      //     - startat text not null
      //     - state text not null
      //     - endat text not null
      //   - *currentPlugin
      //     - name TEXT NOT NULL
      //     - startAt TEXT NOT NULL
      //     - state TEXT NOT NULL
      //     - endAt TEXT NOT NULL
      //   - *completedByPlugin
      //     - name TEXT NOT NULL
      //     - startAt TEXT NOT NULL
      //     - state TEXT NOT NULL
      //     - endAt TEXT NOT NULL

    await this.db.start()
    const createPaymentsStatement = `
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT NOT NULL PRIMARY KEY,
        orderId TEXT NOT NULL,
        clientOrderId TEXT NOT NULL,
        counterpartyURL TEXT NOT NULL,
        memo TEXT NOT NULL,
        sendingPriority TEXT NOT NULL,
        amount TEXT NOT NULL,
        denomination TEXT NOT NULL,
        currency TEXT NOT NULL,
        internalState TEXT NOT NULL,
        pendingPlugins TEXT NOT NULL,
        triedPlugins TEXT NOT NULL,
        currentPlugin TEXT NOT NULL,
        completedByPlugin TEXT NOT NULL,
        direction TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        executeAt INTEGER NOT NULL
      )`

    const createPaymentsQuery = new Promise((resolve, reject) => {
      this.db.sqlite.run(createPaymentsStatement, (err, res) => {
        if (err) return reject(err)
        return resolve(res)
      })
    })

    // XXX it may be good idea to store timestamps as well
    const createOrdersStatement = `
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT NOT NULL PRIMARY KEY,
        clientOrderId TEXT NOT NULL,
        state TEXT NOT NULL,
        frequency INTEGER NOT NULL,

        amount TEXT NOT NULL,

        counterpartyURL TEXT NOT NULL,
        memo TEXT NOT NULL,
        sendingPriority TEXT NOT NULL
      )`

    const createOrdersQuery = new Promise((resolve, reject) => {
      this.db.sqlite.run(createOrdersStatement, (err, res) => {
        if (err) return reject(err)
        return resolve(res)
      })
    })

    await Promise.all([createPaymentsQuery, createOrdersQuery])

    this.ready = true
  }

  async savePayment(payment) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    const params = {
      $id: payment.id,
      $orderId: payment.orderId,
      $clientOrderId: payment.clientOrderId,
      $counterpartyURL: payment.counterpartyURL,
      $memo: payment.memo,
      $sendingPriority: JSON.stringify(payment.sendingPriority),
      $amount: payment.amount,
      $denomination: payment.denomination,
      $currency: payment.currency,
      $internalState: payment.internalState,
      $pendingPlugins: JSON.stringify(payment.pendingPlugins),
      $triedPlugins: JSON.stringify(payment.triedPlugins),
      $currentPlugin: JSON.stringify(payment.currentPlugin),
      $completedByPlugin: JSON.stringify(payment.completedByPlugin),
      $direction: payment.direction,
      $createdAt: payment.createdAt,
      $executeAt: payment.executeAt
    }

    const statement = `
      INSERT INTO payments (
        id,
        orderId,
        clientOrderId,
        counterpartyURL,
        memo,
        sendingPriority,
        amount,
        denomination,
        currency,
        internalState,
        pendingPlugins,
        triedPlugins,
        currentPlugin,
        completedByPlugin,
        direction,
        createdAt,
        executeAt
      ) VALUES (
        $id,
        $orderId,
        $clientOrderId,
        $counterpartyURL,
        $memo,
        $sendingPriority,
        $amount,
        $denomination,
        $currency,
        $internalState,
        $pendingPlugins,
        $triedPlugins,
        $currentPlugin,
        $completedByPlugin,
        $direction,
        $createdAt,
        $executeAt
      )`

    return new Promise((resolve, reject) => {
      this.db.sqlite.run(statement, params, (err, res) => {
          if (err) return reject(err)
          return resolve(res)
        }
      )
    })
  }

  async getPayment(id, opts = {}) { }

  async updatePayment(id, update) { }
//
//  async save (payment) {
//    if (!this.ready) throw new Error(ERROR.NOT_READY)
//
//    this.db[payment.id] = {
//      ...payment,
//      removed: false
//    }
//  }
//
//  async update (id, update) {
//    if (!this.ready) throw new Error(ERROR.NOT_READY)
//
//    this.db[id] = {
//      ...this.db[id],
//      ...update
//    }
//  }
//
//  async delete (id) {
//    if (!this.ready) throw new Error(ERROR.NOT_READY)
//
//    delete this.db[id]
//  }
//
//  async get (id, options = { removed: false }) {
//    if (!this.ready) throw new Error(ERROR.NOT_READY)
//
//    const res = this.db[id]
//    if (!res) return null
//
//    const copy = { ...res }
//    delete copy.removed
//
//    if (options.removed === '*') return copy
//    if (options.removed === true) return res.removed === true ? copy : null
//    if (options.removed === false) return res.removed === false ? copy : null
//  }
//
//  async getPayments (orderId) {
//    if (!this.ready) throw new Error(ERROR.NOT_READY)
//
//    const payments = Object.values(this.db).filter(payment => payment.orderId === orderId)
//    return payments
//  }
}


module.exports = { DB, ERROR }
