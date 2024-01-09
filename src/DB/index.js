const { Sqlite } = require('./Sqlite.js')
const outgoingPaymentSP = require('./outgoingPayment.js')
const orderSP = require('./order.js')
const incomingPaymentSP = require('./incomingPayment.js')

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

    await Promise.all([
      outgoingPaymentSP.createOutgoingPaymentTable(this.db),
      orderSP.createOrderTable(this.db),
      incomingPaymentSP.createIncomingPaymentTable(this.db)
    ])

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
    const { statement, params } = outgoingPaymentSP.savePayment(payment)

    if (execute) return await this.executeStatement(statement, params)
    return { statement, params }
  }

  /**
   * @method saveIncomingPayment - Save a payment to the database
   * @param {Object} payment
   * @param {boolean} execute - Execute the statement or return it
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async saveIncomingPayment (payment, execute = true) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = incomingPaymentSP.savePayment(payment)

    if (execute) return await this.executeStatement(statement, params)
    return { statement, params }
  }

  /**
   * @method getPayment - Save a payment to the database
   * @param {string} id
   * @param {Object} opts
   * @returns {Promise<PaymentObject>}
   */
  async getPayment (id, opts = { removed: false }) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = outgoingPaymentSP.getPayment(id, opts)

    const payment = await this.executeStatement(statement, params)
    return outgoingPaymentSP.deserializePayment(payment)
  }

  /**
   * @method getIncomingPayment - Save a payment to the database
   * @param {string} id
   * @param {Object} opts
   * @returns {Promise<PaymentObject>}
   */
  async getIncomingPayment (id, opts = { removed: false }) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = incomingPaymentSP.getPayment(id, opts)

    const payment = await this.executeStatement(statement, params)
    return incomingPaymentSP.deserializePayment(payment)
  }

  /**
   * @method updatePayment - Update a payment in the database
   * @param {string} id
   * @param {Object} update
   * @param {boolean} execute - Execute the statement or return it
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async updatePayment (id, update, execute = true) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = outgoingPaymentSP.updatePayment(id, update)

    if (execute) return await this.executeStatement(statement, params)
    return { statement, params }
  }

  /**
   * @method updateIncomingPayment - Update a payment in the database
   * @param {string} id
   * @param {Object} update
   * @param {boolean} execute - Execute the statement or return it
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async updateIncomingPayment (id, update, execute = true) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = incomingPaymentSP.updatePayment(id, update)

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
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = outgoingPaymentSP.getPayments(opts)

    const payments = await this.executeStatement(statement, params, 'all')
    return payments.map(outgoingPaymentSP.deserializePayment)
  }

  // XXX: super naive
  // TODO: add pagination
  // ...
  /**
   * @method getPayments - Get payments from the database
   * @param {Object} opts
   * @returns {Promise<Array<PaymentObject>>}
   */
  async getIncomingPayments (opts = {}) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = incomingPaymentSP.getPayments(opts)

    const payments = await this.executeStatement(statement, params, 'all')
    return payments.map(incomingPaymentSP.deserializePayment)
  }

  /**
   * @method saveOrder - Save an order to the database
   * @param {Object} order
   * @param {boolean} execute - Execute the statement or return it
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async saveOrder (order, execute = true) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = orderSP.saveOrder(order)

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
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = orderSP.getOrder(id, opts)

    const order = await this.executeStatement(statement, params)
    return orderSP.deserializeOrder(order)
  }

  /**
   * @method updateOrder - Update an order in the database
   * @param {string} id
   * @param {Object} update
   * @param {boolean} execute - Execute the statement or return it
   * @returns {Promise<Database| { statement: string, params: object }>}
   */
  async updateOrder (id, update, execute = true) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    const { statement, params } = orderSP.updateOrder(id, update)

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
}

module.exports = { DB, ERROR }
