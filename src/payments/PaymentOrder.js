const { Payment } = require('./Payment')
const { PaymentAmount } = require('./PaymentAmount')
/**
 * Payment Order class
 * @class PaymentOrder - This class is used to create a payments
 * @property {string} id - Order id
 * @property {string} clientOrderId - Client order id
 * @property {string} type - Order type
 * @property {string} state - Order state
 * @property {string} frequency - Order frequency
 * @property {Payment[]} payments - Payments associated with this order
 * @property {PaymentAmount} amount - Payment amount
 * @property {string} targetURL - Target URL
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
    this.type = orderParams.type || ORDER_TYPE.ONE_TIME
    if (this.type === ORDER_TYPE.ONE_TIME) {
      this.frequency = null
    } else {
      this.frequency = orderParams.frequency
    }

    this.payments = []

    this.amount = new PaymentAmount(orderParams)
    this.targetURL = orderParams.targetURL
    this.memo = orderParams.memo || ''
    this.sendingPriority = orderParams.sendingPriority

    if (this.type === ORDER_TYPE.RECCURING) {
      throw new Error(ERRORS.NOT_IMPLEMENTED)
    }
  }

  /**
   * @method init - Initialize order and create payments
   * @returns {Promise<void>}
   */
  async init () {
    this.id = PaymentOrder.generateId()
    // TODO: check if order with this.clientOrderId already exists
    this.state = ORDER_STATE.INITIALIZED
    if (this.orderParams.type === ORDER_TYPE.RECCURING) {
      await this.createReccuringOrder()
    } else {
      await this.createOneTimeOrder()
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

  async createReccuringOrder () {
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
    return this.payments.find((payment) => !payment.internalState.isFinal())
  }

  /**
   * @method getPaymentInProgress - Get payment in progress
   * @returns {Payment}
   */
  getPaymentInProgress () {
    return this.payments.find((payment) => payment.internalState.isInProgress())
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
      .filter((payment) => !payment.internalState.isFinal())
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
      type: this.type,
      state: this.state,
      frequency: this.frequency,

      targetURL: this.targetURL,
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
    const paymentOrder = new PaymentOrder(orderParams, db)

    // TODO: fill payments from db by orderId

    return paymentOrder
  }
}

/**
 * @typedef {Obejct} ERRROS
 * @property {string} NOT_IMPLEMENTED
 * @property {string} ORDER_PARAMS_REQUIRED
 * @property {string} ORDER_AMOUNT_REQUIRED
 * @property {string} ORDER_TARGET_URL_REQUIRED
 * @property {string} ORDER_CLIENT_ORDER_ID_REQUIRED
 * @property {string} ORDER_CONFIG_REQUIRED
 * @property {string} ORDER_CONFIG_SENDING_PARTY_REQUIRED
 * @property {string} DB_REQUIRED
 * @property {string} DB_NOT_READY
 * @property {string} OUTSTANDING_PAYMENTS
 * @property {string} ORDER_CANCELLED
 * @property {string} ORDER_COMPLETED
 * @property {string} CAN_NOT_PROCESS_ORDER
 */
const ERRORS = {
  NOT_IMPLEMENTED: 'Not implemented',
  ORDER_PARAMS_REQUIRED: 'Order params are required',
  ORDER_AMOUNT_REQUIRED: 'Order amount is required',
  ORDER_TARGET_URL_REQUIRED: 'Order target url is required',
  ORDER_CLIENT_ORDER_ID_REQUIRED: 'Order client order id is required',
  ORDER_CONFIG_REQUIRED: 'Order config is required',
  ORDER_CONFIG_SENDING_PARTY_REQUIRED: 'Order config sending party is required',
  DB_REQUIRED: 'DB is required',
  DB_NOT_READY: 'DB is not ready',
  OUTSTANDING_PAYMENTS: 'There are outstanding payments',
  ORDER_CANCELLED: 'Order is cancelled',
  ORDER_COMPLETED: 'Order is completed',
  CAN_NOT_PROCESS_ORDER: 'Can not process order'
}

/**
 * @typedef {Object} ORDER_TYPE
 * @property {string} ONE_TIME
 * @property {string} RECCURING
 */
const ORDER_TYPE = {
  ONE_TIME: 'one-time',
  RECCURING: 'reccuring'
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

module.exports = { PaymentOrder, ORDER_TYPE, ORDER_STATE, ERRORS }
