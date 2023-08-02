const { Sqlite } = require('./Sqlite.js')

const ERROR = {
  NOT_READY: 'DB is not ready'
}

/**
 * @class DB
 * @param {Object} config
 * @param {String} config.path
 * @param {String} config.name
 */
class DB {
  constructor (config) {
    this.db = new Sqlite(config)
    this.ready = false
  }

  /**
   * @method init - Initialize the database
   * @returns {Promise}
   */
  async init () {
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
        executeAt INTEGER NOT NULL,
        removed INTEGER NOT NULL DEFAULT 0
      )`

    const createPaymentsQuery = new Promise((resolve, reject) => {
      this.db.sqlite.run(createPaymentsStatement, (err, res) => {
        if (err) return reject(err)
        return resolve(res)
      })
    })

    const createOrdersStatement = `
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT NOT NULL PRIMARY KEY,
        clientOrderId TEXT NOT NULL,
        state TEXT NOT NULL,
        frequency INTEGER NOT NULL,

        amount TEXT NOT NULL,
        denomination TEXT NOT NULL,
        currency TEXT NOT NULL,

        counterpartyURL TEXT NOT NULL,
        memo TEXT NOT NULL,
        sendingPriority TEXT NOT NULL,

        createdAt INTEGER NOT NULL,
        firstPaymentAt INTEGER NOT NULL,
        lastPaymentAt INTEGER DEFAULT NULL,

        removed INTEGER NOT NULL DEFAULT 0
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

  /**
   * @method savePayment - Save a payment to the database
   * @param {Object} payment
   * @param {boolean} execute - Execute the statement or return it
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async savePayment (payment, execute = true) {
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

    if (execute) return await this.executeStatement(statement, params)
    return { statement, params }
  }

  /**
   * @method savePayment - Save a payment to the database
   * @param {string} id
   * @param {Object} opts
   * @returns {Promise<PaymentObject>}
   */
  async getPayment (id, opts = { removed: false }) {
    const params = { $id: id }
    let statement = 'SELECT * FROM payments WHERE id = $id'

    if (opts.removed === true || opts.removed === 'true' || opts.removed === 1 || opts.removed === '1') {
      statement += ' AND removed = 1'
    } else if (opts.removed === false || opts.removed === 'false' || opts.removed === 0 || opts.removed === '0') {
      statement += ' AND removed = 0'
    }

    statement += ' LIMIT 1'

    const payment = await this.executeStatement(statement, params)
    return this.deserializePayment(payment)
  }

  /**
   * @method updatePayment - Update a payment in the database
   * @param {string} id
   * @param {Object} update
   * @param {boolean} execute - Execute the statement or return it
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async updatePayment (id, update, execute = true) {
    let statement = 'UPDATE payments SET '
    const params = { $id: id }

    Object.keys(update).forEach((k, i) => {
      if (k === 'id') return

      statement += `${k} = $${k}`
      if (i !== Object.keys(update).length - 1) statement += ', '

      params[`$${k}`] = (typeof update[k] === 'object') ? JSON.stringify(update[k]) : update[k]
    })

    statement += ' WHERE id = $id'

    if (execute) return await this.executeStatement(statement, params)
    return { statement, params }
  }

  // XXX: super naive
  // TODO: add pagination
  // ...
  /**
   * @method getPayments - Get payments from the database
   * @param {Object} opts
   * @returns {Promise<Array<PaymentObject>>}
   */
  async getPayments (opts = {}) {
    const params = {}
    let statement = 'SELECT * FROM payments'
    if (Object.keys(opts).length > 0) statement += ' WHERE '
    Object.keys(opts).forEach((k, i) => {
      statement += ` ${k} = $${k}`
      if (i !== Object.keys(opts).length - 1) statement += ' AND '

      if (typeof opts[k] !== 'string') throw new Error('Only string params are supported')

      params[`$${k}`] = opts[k]
    })

    statement += ' ORDER BY createdAt DESC'

    const payments = await this.executeStatement(statement, params, 'all')
    return payments.map(this.deserializePayment)
  }

  /**
   * @method saveOrder - Save an order to the database
   * @param {Object} order
   * @param {boolean} execute - Execute the statement or return it
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async saveOrder (order, execute = true) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    const params = {
      $id: order.id,
      $clientOrderId: order.clientOrderId,
      $state: order.state,
      $frequency: order.frequency,
      $amount: order.amount,
      $denomination: order.denomination,
      $currency: order.currency,
      $counterpartyURL: order.counterpartyURL,
      $memo: order.memo,
      $sendingPriority: JSON.stringify(order.sendingPriority),
      $createdAt: order.createdAt,
      $firstPaymentAt: order.firstPaymentAt,
      $lastPaymentAt: order.lastPaymentAt
    }

    const statement = `
      INSERT INTO orders (
        id,
        clientOrderId,
        state,
        frequency,
        amount,
        denomination,
        currency,
        counterpartyURL,
        memo,
        sendingPriority,
        createdAt,
        firstPaymentAt,
        lastPaymentAt
      ) VALUES (
        $id,
        $clientOrderId,
        $state,
        $frequency,
        $amount,
        $denomination,
        $currency,
        $counterpartyURL,
        $memo,
        $sendingPriority,
        $createdAt,
        $firstPaymentAt,
        $lastPaymentAt
      )`

    if (execute) return await this.executeStatement(statement, params)
    return { statement, params }
  }

  /**
   * @method getOrder - Get an order from the database
   * @param {string} id
   * @param {Object} opts
   * @returns {Promise<OrderObject>}
   */
  async getOrder (id, opts = { removed: false }) {
    const params = { $id: id }
    let statement = 'SELECT * FROM orders WHERE id = $id'

    if (opts.removed === true || opts.removed === 'true' || opts.removed === 1 || opts.removed === '1') {
      statement += ' AND removed = 1'
    } else if (opts.removed === false || opts.removed === 'false' || opts.removed === 0 || opts.removed === '0') {
      statement += ' AND removed = 0'
    }

    statement += ' LIMIT 1'

    const order = await this.executeStatement(statement, params)
    return this.deserializeOrder(order)
  }

  /**
   * @method updateOrder - Update an order in the database
   * @param {string} id
   * @param {Object} update
   * @param {boolean} execute - Execute the statement or return it
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async updateOrder (id, update, execute = true) {
    let statement = 'UPDATE orders SET '
    const params = { $id: id }

    Object.keys(update).forEach((k, i) => {
      if (k === 'id') return

      statement += `${k} = $${k}`
      if (i !== Object.keys(update).length - 1) statement += ', '

      params[`$${k}`] = (typeof update[k] === 'object') ? JSON.stringify(update[k]) : update[k]
    })

    statement += ' WHERE id = $id'

    if (execute) return await this.executeStatement(statement, params)
    return { statement, params }
  }

  /**
   * @method executeStatement - Execute a statement on the database
   * @param {string} statement
   * @param {Object} params
   * @param {string} method
   * @returns {Promise<Database>}
   */
  async executeStatement (statement, params, method = 'get') {
    return await new Promise((resolve, reject) => {
      if (method === 'exec') {
        this.db.sqlite[method](statement, (err, res) => {
          if (err) return reject(err)
          return resolve(res)
        })
      } else {
        this.db.sqlite[method](statement, params, (err, res) => {
          if (err) return reject(err)
          return resolve(res)
        })
      }
    })
  }

  /**
   * @method deserializePayment - Deserialize a payment object
   * @param {Object} payment
   * @returns {PaymentObject|null}
   */
  deserializePayment (payment) {
    if (!payment) return null

    const res = {
      ...payment,
      sendingPriority: JSON.parse(payment.sendingPriority || '[]'),
      pendingPlugins: JSON.parse(payment.pendingPlugins || '[]'),
      triedPlugins: JSON.parse(payment.triedPlugins || '[]'),
      currentPlugin: JSON.parse(payment.currentPlugin || '{}'),
      completedByPlugin: JSON.parse(payment.completedByPlugin || '{}')
    }

    delete res.removed

    return res
  }

  /**
   * @method deserializeOrder - Deserialize an order object
   * @param {Object} order
   * @returns {OrderObject|null}
   */
  deserializeOrder (order) {
    if (!order) return null

    const res = {
      ...order,
      sendingPriority: JSON.parse(order.sendingPriority || '[]')
    }

    delete res.removed

    return res
  }
}

module.exports = { DB, ERROR }
