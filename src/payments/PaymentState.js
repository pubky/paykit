class PaymentState {
  constructor(payment, state) {
    this.state = payment.internalState || state || PAYMENT_STATE.INITIAL

    // TODO: get from params
    this.pendingPlugins = []
    this.processedBy = []
    this.processingPlugin = null
    this.sentByPlugin = null

    PaymentState.validate(payment)
    this.payment = payment
  }

  static validate(payment) {
    if (!payment) throw new Error('Payment is required')
    if (!payment.db) throw new Error('Payment db is required')
    if (!payment.db.ready) throw new Error('Payment db is not ready')
  }

  serialize() {
    return {
      state: this.state,
      pendingPlugins: this.pendingPlugins,
      processedBy: this.processedBy,
      processingPlugin: this.processingPlugin,
      sentByPlugin: this.sentByPlugin
    }
  }

  currentState() {
    return this.state
  }

  isInitial() {
    return this.currentState() === PAYMENT_STATE.INITIAL
  }

  isInProgress() {
    return this.currentState() === PAYMENT_STATE.IN_PROGRESS
  }

  isCompleted() {
    return this.currentState() === PAYMENT_STATE.COMPLETED
  }

  isFailed() {
    return this.currentState() === PAYMENT_STATE.FAILED
  }

  isCancelled() {
    return this.currentState() === PAYMENT_STATE.CANCELLED
  }

  isFinal() {
    return this.isCompleted() || this.isFailed() || this.isCancelled()
  }

  async cancel() {
    if (!this.isInitial()) throw new Error(ERRORS.INVALID_STATE(this.state))

    this.state = PAYMENT_STATE.CANCELLED
    await this.payment.update()
  }

  async fail() {
    if (!this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.state))

    this.state = PAYMENT_STATE.FAILED
    this.processingPlugin = null

    await this.payment.update()
  }

  async proccess() {
    if (!this.isInitial() || !this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.state))

    if (this.pendingPlugins.length === 0) {
      await this.fail()
      throw new Error('No plugins to process')
    }

    this.state = PAYMENT_STATE.IN_PROGRESS
    this.processingPlugin = this.pendingPlugins.shift()

    await this.payment.update()
  }

  async complete() {
    if (!this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.state))

    this.processedBy.push(this.processingPlugin)
    this.sentByPlugin = this.procssingPluging
    this.processingPlugin = null

    this.state = PAYMENT_STATE.COMPLETED
    await this.payment.update()
  }
}

/**
 * @typedef {Object} PaymentState
 * @property {string} INITIAL - initial state
 * @property {string} IN_PROGRESS - in progress state
 * @property {string} COMPLETED - completed state
 * @property {string} FAILED - failed state
 * @property {string} CANCELLED - cancelled state
 */
const PAYMENT_STATE = {
  INITIAL: 'initial',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

const ERRORS = {
  INVALID_STATE: (s) => `Invalid state: ${s}`
}

module.exports = {
  PaymentState,
  PAYMENT_STATE,
  ERRORS
}
