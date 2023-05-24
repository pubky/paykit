const { Payment } = require('./Payment')
const { PaymentAmount } = require('./PaymentAmount')
/**
 * Payment Order class
 * @class PaymentOrder - This class is used to create a payments
 * @property {string} id - Order id
 * @property {string} clientOrderId - Client order id
 * @property {string} state - Order state
 * @property {number} frequency - Order frequency in seconds, 0 for one time order
 * @property {Payment[]} payments - Payments associated with this order
 * @property {PaymentAmount} amount - Payment amount
 * @property {string} counterpartyURL - Counterparty URL
 * @property {string} memo - Memo
 * @property {string} sendingPriority - Sending priority
 * @property {object} orderParams - Order params
 * @property {object} db - Database
 */

class PaymentOrder {
  static generateId () {
    return 'totally-random-order-id'
  }

  /**
   * @constructor - PaymentOrder constructor
   * @param {object} orderParams - Order params
   * @param {object} db - Database
   * @returns {PaymentOrder}
   */
  constructor (orderParams, db) {
    this.orderParams = orderParams
    this.db = db

    this.id = orderParams.id || null
    this.clientOrderId = orderParams.clientOrderId

    this.state = orderParams.state || ORDER_STATE.CREATED

    this.clientOrderId = orderParams.clientOrderId

    // parse float is for potential support of fractions of seconds
    this.frequency = orderParams.frequency ? parseFloat(orderParams.frequency) : 0
    if (isNaN(this.frequency) || this.frequency < 0) {
      throw new Error(ERRORS.INVALID_FREQUENCY(orderParams.frequency))
    } else if (this.frequency === 0) { // TODO: remove
    } else { // TODO: for recurring payments we specify:
      // the first payment date-time
      // the frequency
      // optional end date-time
      throw new Error(ERRORS.NOT_IMPLEMENTED) // TODO: remove
    }

    this.payments = []

    this.amount = new PaymentAmount(orderParams)
    this.counterpartyURL = orderParams.counterpartyURL
    this.memo = orderParams.memo || ''
    this.sendingPriority = orderParams.sendingPriority
  }

  /**
   * @method init - Initialize order and create payments
   * @returns {Promise<void>}
   */
  async init () {
    this.id = PaymentOrder.generateId()
    // TODO: check if order with this.clientOrderId already exists
    this.state = ORDER_STATE.INITIALIZED
    if (this.frequency === 0) {
      await this.createOneTimeOrder()
    } else {
      await this.createRecurringOrder()
    }

    this.save()
  }

  /**
   * Crate one time order
   * @returns {Promise<void>}
   */
  async createOneTimeOrder () {
    const payment = new Payment(
      { ...this.orderParams, orderId: this.id },
      this.db
    )
    await payment.init()

    this.payments.push(payment)
  }

  async createRecurringOrder () {
    // TODO: save order and payments to db in a single transaction
    throw new Error(ERRORS.NOT_IMPLEMENTED)
  }

  /**
   * @method process - Process order
   * @returns {Promise<Payment>}
   */
  async process () {
    if (!this.canProcess()) throw new Error(ERRORS.CAN_NOT_PROCESS_ORDER)

    const paymentInProgress = this.getPaymentInProgress()
    if (paymentInProgress) return await paymentInProgress.process()

    // TODO: refactor this if completion is moved out of this class
    // by moving getFirstOutstandingPayment() to processPayment
    const payment = this.getFirstOutstandingPayment()
    if (payment) {
      return await this.processPayment(payment)
    } else {
      // XXX: consider moving out of this class?
      return await this.complete()
    }
  }

  /**
   * Checks if order is ready to be processed
   * @method canProcess
   * @returns {boolean}
   */
  canProcess () {
    return this.state === ORDER_STATE.INITIALIZED || this.state === ORDER_STATE.PROCESSING
  }

  /**
   * @method processPayment - Process payment
   * @param {Payment} payment - Payment to process
   * @returns {Promise<Payment>}
   */
  async processPayment (payment) {
    if (payment.executeAt > Date.now()) return payment

    if (this.state !== ORDER_STATE.PROCESSING) {
      this.state = ORDER_STATE.PROCESSING
      await this.update()
    }

    return await payment.process()
  }

  /**
   * @method getFirstOutstandingPayment - Get first outstanding payment
   * @returns {Payment}
   */
  getFirstOutstandingPayment () {
    return this.payments.find((payment) => !payment.isFinal())
  }

  /**
   * @method getPaymentInProgress - Get payment in progress
   * @returns {Payment}
   */
  getPaymentInProgress () {
    return this.payments.find((payment) => payment.isInProgress())
  }

  /**
   * @method complete - Complete order
   * @throws {Error} - If order is already completed
   * @throws {Error} - If order is cancelled
   * @returns {Promise<Payment>} - Last payment
   */
  async complete () {
    if (this.state === ORDER_STATE.CANCELLED) throw new Error(ERRORS.ORDER_CANCELLED)
    if (this.state === ORDER_STATE.COMPLETED) throw new Error(ERRORS.ORDER_COMPLETED)

    if (this.payments.every((payment) => payment.internalState.isFinal())) {
      this.state = ORDER_STATE.COMPLETED
      await this.update()
    } else {
      throw new Error(ERRORS.OUTSTANDING_PAYMENTS)
    }

    return this.payments[this.payments.length - 1]
  }

  /**
   * @method cancel - Cancel order and all outstanding payments
   * @throws {Error} - If order is already completed
   * @returns {Promise<void>}
   */
  async cancel () {
    if (this.state === ORDER_STATE.COMPLETED) {
      throw new Error(ERRORS.ORDER_COMPLETED)
    }

    // TODO: db transaction
    await this.payments
      .filter((payment) => !payment.isFinal())
      .forEach(async (payment) => {
        await payment.cancel()
      })

    this.state = ORDER_STATE.CANCELLED
    await this.update()
  }

  /**
   * @method serialize - serialize order
   * @returns {Object}
   */
  serialize () {
    return {
      id: this.id,
      clientOrderId: this.clientOrderId,
      state: this.state,
      frequency: this.frequency,

      counterpartyURL: this.counterpartyURL,
      memo: this.memo,
      sendingPriority: this.sendingPriority,
      ...this.amount.serialize()
    }
  }

  /**
   * @method save - Save order with all corresponding payments to db
   * @returns {Promise<void>}
   */
  async save () {
    // TODO: needs to be more sophisticated than this
    // check if payment already exists as well
    // save corresponding payments
    //    if (this.id) {
    //      const order = await this.db.get(this.id, { removed: '*' })
    //      if (order) throw new Error(ERRORS.ALREADY_EXISTS(this.id))
    //      // something very fishy is going on
    //    }
    //
    //    this.id = PaymentOrder.generateId()
    const orderObject = this.serialize()
    // Order.validateOrderObject(orderObject)

    // TODO: db transaction
    await this.db.save(orderObject)
    await Promise.all(this.payments.map(async (payment) => {
      await payment.save()
    }))
  }

  /**
   * @method update - Update order in db
   * @returns {Promise<void>}
   */
  async update () {
    // TODO: add some validation
    // also check for state and existing payments associated with this order
    const serialized = this.serialize()
    // Payment.validatePaymentObject(serialized)
    await this.db.update(this.id, serialized)
  }

  /**
   * @static find - Find order by id in db
   * @param {string} id - Order id
   * @param {DB} db - DB instance
   * @returns {Promise<PaymentOrder>}
   */
  static async find (id, db) {
    const orderParams = await db.get(id)
    if (!orderParams) throw new Error(ERRORS.ORDER_NOT_FOUND(id))

    const paymentOrder = new PaymentOrder(orderParams, db)
    paymentOrder.payments = (await db.getPayments(id)).map(p => new Payment(p, db))

    return paymentOrder
  }
}

/**
 * @typedef {Obejct} ERRROS
 * @property {string} NOT_IMPLEMENTED
 * @property {string} ORDER_PARAMS_REQUIRED
 * @property {string} ORDER_AMOUNT_REQUIRED
 * @property {string} ORDER_COUNTERPARTY_URL_REQUIRED
 * @property {string} ORDER_CLIENT_ORDER_ID_REQUIRED
 * @property {string} ORDER_CONFIG_REQUIRED
 * @property {string} ORDER_CONFIG_SENDING_PARTY_REQUIRED
 * @property {string} DB_REQUIRED
 * @property {string} DB_NOT_READY
 * @property {string} OUTSTANDING_PAYMENTS
 * @property {string} ORDER_CANCELLED
 * @property {string} ORDER_COMPLETED
 * @property {string} CAN_NOT_PROCESS_ORDER
 * @property {function} ORDER_NOT_FOUND
 * @property {function} INVALID_FREQUENCY
 */
const ERRORS = {
  NOT_IMPLEMENTED: 'Not implemented',
  ORDER_PARAMS_REQUIRED: 'Order params are required',
  ORDER_AMOUNT_REQUIRED: 'Order amount is required',
  ORDER_COUNTERPARTY_URL_REQUIRED: 'Order coutnerparty url is required',
  ORDER_CLIENT_ORDER_ID_REQUIRED: 'Order client order id is required',
  ORDER_CONFIG_REQUIRED: 'Order config is required',
  ORDER_CONFIG_SENDING_PARTY_REQUIRED: 'Order config sending party is required',
  DB_REQUIRED: 'DB is required',
  DB_NOT_READY: 'DB is not ready',
  OUTSTANDING_PAYMENTS: 'There are outstanding payments',
  ORDER_CANCELLED: 'Order is cancelled',
  ORDER_COMPLETED: 'Order is completed',
  CAN_NOT_PROCESS_ORDER: 'Can not process order',
  ORDER_NOT_FOUND: (id) => `Order with id ${id} not found`,
  INVALID_FREQUENCY: (frequency) => `Invalid frequency ${frequency}`
}

/**
 * @typedef {Object} ORDER_STATE
 * @property {string} CREATED
 * @property {string} INITIALIZED
 * @property {string} PROCESSING
 * @property {string} COMPLETED
 * @property {string} CANCELLED
 */
const ORDER_STATE = {
  CREATED: 'created',
  INITIALIZED: 'initialized',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
}

module.exports = { PaymentOrder, ORDER_STATE, ERRORS }
