class PaymentState {
  constructor (payment) {
    PaymentState.validate(payment)

    if (payment.sentByPlugin) {
      this.internalState = PAYMENT_STATE.COMPLETED
    } else {
      this.internalState = payment.internalState || PAYMENT_STATE.INITIAL
    }

    this.pendingPlugins = payment.pendingPlugins || []
    this.triedPlugins = payment.triedPlugins || []

    this.currentPlugin = payment.currentPlugin || null
    this.sentByPlugin = payment.sentByPlugin || null

    this.payment = payment
  }

  assignPendingPlugins(pendingPlugins) {
    this.pendingPlugins = [...pendingPlugins]
  }

  static validate (payment) {
    if (!payment) throw new Error('Payment is required')
    if (!payment.db) throw new Error('Payment db is required')
    if (!payment.db.ready) throw new Error('Payment db is not ready')
  }

  serialize () {
    return {
      internalState: this.internalState,
      pendingPlugins: [...this.pendingPlugins],
      triedPlugins: [...this.triedPlugins],
      currentPlugin: { ...this.currentPlugin },
      sentByPlugin: { ...this.sentByPlugin }
    }
  }

  currentState () { return this.internalState }

  isInitial () { return this.currentState() === PAYMENT_STATE.INITIAL }

  isInProgress () { return this.currentState() === PAYMENT_STATE.IN_PROGRESS }

  isCompleted () { return this.currentState() === PAYMENT_STATE.COMPLETED }

  isFailed () { return this.currentState() === PAYMENT_STATE.FAILED }

  isCancelled () { return this.currentState() === PAYMENT_STATE.CANCELLED }

  isFinal () { return this.isCompleted() || this.isFailed() || this.isCancelled() }

  async cancel () {
    if (!this.isInitial()) throw new Error(ERRORS.INVALID_STATE(this.internalState))
    if (this.currentPlugin) {
      // Belt and suspenders
      // should not be possible as currentPlugin must not be assigned in initial internalState
      throw new Error('Cannot cancel while processing')
    }

    this.internalState = PAYMENT_STATE.CANCELLED
    await this.payment.update()
  }

  async process () {
    if (this.isInitial()) {
      this.internalState = PAYMENT_STATE.IN_PROGRESS
      await this.payment.update()
    }

    if (this.pendingPlugins.length === 0) return await this.fail()

    return await this.tryNext()
  }

  async fail () {
    if (!this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.internalState))

    this.markCurrentPluginAsTried()
    this.internalState = PAYMENT_STATE.FAILED

    await this.payment.update()
  }

  async tryNext () {
    if (!this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.internalState))

    if (this.currentPlugin) this.markCurrentPluginAsTried()

    this.currentPlugin = { name: this.pendingPlugins.shift(), startAt: Date.now() }
    await this.payment.update()
  }

  async complete () {
    if (!this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.internalState))

    this.sentByPlugin = this.markCurrentPluginAsTried()

    this.internalState = PAYMENT_STATE.COMPLETED
    await this.payment.update()
  }

  getCompletedCurrentPlugin () {
    return { ...this.currentPlugin, endAt: Date.now() }
  }

  markCurrentPluginAsTried () {
    const completedPlugin = this.getCompletedCurrentPlugin()
    this.triedPlugins.push({ ...completedPlugin })
    this.currentPlugin = null

    return completedPlugin
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
