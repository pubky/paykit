const { isEmptyObject } = require('../utils')
const logger = require('slashtags-logger')('Slashpay', 'payment-state')
/**
 * PaymentState class
 * @class PaymentState
 * @property {string} internalState - internal state
 * @property {string[]} pendingPlugins - pending plugins
 * @property {StatePlugin[]} triedPlugins - tried plugins
 * @property {StatePlugin} currentPlugin - current plugin
 * @property {StatePlugin} completedByPlugin - sent by plugin
 * @property {Payment} payment - payment
 */
class PaymentState {
  /**
   * @param {Payment} payment - payment
   * @property {string} [payment.internalState] - internal state
   * @property {string[]} [payment.pendingPlugins] - pending plugins
   * @property {StatePlugin[]} [payment.triedPlugins] - tried plugins
   * @property {StatePlugin} [payment.currentPlugin] - current plugin
   * @property {StatePlugin} [payment.completedByPlugin] - sent by plugin
   * @param {Object} [params] - parameters to overwrite payment
   * @property {string} [params.internalState] - internal state
   * @property {string[]} [params.pendingPlugins] - pending plugins
   * @property {StatePlugin[]} [params.triedPlugins] - tried plugins
   * @property {StatePlugin} [params.currentPlugin] - current plugin
   * @property {StatePlugin} [params.completedByPlugin] - sent by plugin
   * @throws {Error} - if payment is not provided
   */
  constructor (payment, params = {}) {
    PaymentState.validate(payment)
    logger.debug(`Using payment state with ${JSON.stringify(params)}`)

    this.internalState = payment.internalState || params.internalState || PAYMENT_STATE.INITIAL

    this.pendingPlugins = payment.pendingPlugins || params.pendingPlugins || []
    this.triedPlugins = payment.triedPlugins || params.triedPlugins || []

    this.currentPlugin = payment.currentPlugin || params.currentPlugin || null
    this.completedByPlugin = payment.completedByPlugin || params.completedByPlugin || null

    this.payment = payment
    logger.debug('Initialized payment state')

    this.logger = {
      debug: (msg) => { logger.debug.extend(JSON.stringify(this.serialize()))({ msg }) },
      info: (msg) => { logger.info.extend(JSON.stringify(this.serialize()))({ msg }) }
    }
  }

  /**
   * Returns string representation of payment state used for logging
   */
  [Symbol.for('nodejs.util.inspect.custom')] () {
    return JSON.stringify(this.serialize())
  }

  /**
   * Assigns pending plugins
   * @param {string[]} pendingPlugins - pending plugins
   * @throws {Error} - if pendingPlugins is not an array
   * @returns {void}
   */
  assignPendingPlugins (pendingPlugins) {
    this.logger.debug(`Assigning pending plugins ${pendingPlugins}`)

    if (!Array.isArray(pendingPlugins)) throw new Error(ERRORS.PENDING_PLUGINS_NOT_ARRAY)
    this.pendingPlugins = [...pendingPlugins]

    this.logger.debug('Assigned pending plugins')
  }

  /**
   * Validates payment
   * @param {Payment} payment - payment
   * @throws {Error} - if payment is not provided
   * @throws {Error} - if payment db is not provided
   * @throws {Error} - if payment db is not ready
   * @returns {void}
   */
  static validate (payment) {
    logger.debug('Validating payment')

    if (!payment) throw new Error(ERRORS.PAYMENT_REQUIRED)
    if (!payment.db) throw new Error(ERRORS.DB_REQUIRED)
    if (!payment.db.ready) throw new Error(ERRORS.DB_NOT_READY)

    logger.debug('Validated payment')
  }

  /**
   * Serializes payment state
   * @returns {Object} - serialized payment state
   * @returns {string} [returns.internalState] - internal state
   * @returns {string[]} [returns.pendingPlugins] - pending plugins
   * @returns {StatePlugin[]} [returns.triedPlugins] - tried plugins
   * @returns {StatePlugin} [returns.currentPlugin] - current plugin
   * @returns {StatePlugin} [returns.completedByPlugin] - sent by plugin
   */
  serialize () {
    return {
      internalState: this.internalState,
      pendingPlugins: [...this.pendingPlugins],
      triedPlugins: [...this.triedPlugins],
      currentPlugin: { ...this.currentPlugin },
      completedByPlugin: { ...this.completedByPlugin }
    }
  }

  /**
   * Returns current state
   * @returns {string} - current state
   */
  currentState = () => this.internalState

  /**
   * Returns true if current state is initial
   * @returns {boolean} - true if current state is initial
   * @returns {boolean} - false if current state is not initial
   */
  isInitial = () => this.currentState() === PAYMENT_STATE.INITIAL

  /**
   * Returns true if current state is in progress
   * @returns {boolean} - true if current state is in progress
   * @returns {boolean} - false if current state is not in progress
   */
  isInProgress = () => this.currentState() === PAYMENT_STATE.IN_PROGRESS

  /**
   * Returns true if current state is completed
   * @returns {boolean} - true if current state is completed
   * @returns {boolean} - false if current state is not completed
   */
  isCompleted = () => this.currentState() === PAYMENT_STATE.COMPLETED

  /**
   * Returns true if current state is failed
   * @returns {boolean} - true if current state is failed
   * @returns {boolean} - false if current state is not failed
   */
  isFailed = () => this.currentState() === PAYMENT_STATE.FAILED

  /**
   * Returns true if current state is cancelled
   * @returns {boolean} - true if current state is cancelled
   * @returns {boolean} - false if current state is not cancelled
   */
  isCancelled = () => this.currentState() === PAYMENT_STATE.CANCELLED

  /**
   * Returns true if current state is final
   * @returns {boolean} - true if current state is completed or failed or cancelled
   * @returns {boolean} - false if current state is not completed or failed or cancelled
   */
  isFinal = () => this.isCompleted() || this.isFailed() || this.isCancelled()

  /**
   * Cancel payment - sets internal state to cancelled and updates payment in db
   * @throws {Error} - if current state is not initial
   */
  async cancel (persist = true) {
    this.logger.info('Cancelling payment')
    if (!this.isInitial()) throw new Error(ERRORS.INVALID_STATE(this.internalState))
    if (!isEmptyObject(this.currentPlugin)) {
      // Belt and suspenders
      // should not be possible as currentPlugin must not be assigned in initial internalState
      throw new Error('Cannot cancel while processing')
    }

    this.internalState = PAYMENT_STATE.CANCELLED
    const res = await this.payment.update(persist)
    this.logger.debug('Cancelled payment')

    return res
  }

  /**
   * Process payment - sets internal state to in progress and updates payment in db for new payments
   * fails payment if there are no pending plugins and updates payment in db
   * tries next plugin if there are pending plugins and updates payment in db
   * @throws {Error} - if current state is not initial
   * @returns {boolean} - true if next plugin is tried
   * @returns {boolean} - false if payment is failed
   */
  async process () {
    this.logger.info('Processing payment')
    if (this.isInitial()) {
      this.internalState = PAYMENT_STATE.IN_PROGRESS
      await this.payment.update()
    }

    if (!isEmptyObject(this.currentPlugin)) throw new Error(ERRORS.PLUGIN_IN_PROGRESS(this.currentPlugin.name))

    if (this.pendingPlugins.length === 0) {
      await this.fail()
      return false
    }

    return await this.tryNext()
  }

  /**
   * Mark current plugin as tried with failed state
   * @returns {void}
   */
  async failCurrentPlugin () {
    this.logger.info('Failing current plugin')
    if (!this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.internalState))
    // XXX: this should not be possible
    if (isEmptyObject(this.currentPlugin)) throw new Error('No current plugin')

    this.markCurrentPluginAsTried(PLUGIN_STATE.FAILED)
    this.logger.debug(`Marked current plugin ${this.currentPlugin?.name} as tried with failed state`)
    await this.payment.update()
  }

  /**
   * Fail payment - sets internal state to failed and updates payment in db
   * @throws {Error} - if current state is not in progress
   * @returns {void}
   */
  async fail () {
    this.logger.info('Failing payment')
    if (!this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.internalState))

    if (!isEmptyObject(this.currentPlugin)) await this.failCurrentPlugin()

    this.internalState = PAYMENT_STATE.FAILED
    this.logger.debug('Failed payment')
    await this.payment.update()
  }

  /**
   * Try next plugin - sets current plugin to next pending plugin and updates payment in db
   * @throws {Error} - if current state is not in progress
   * @returns {boolean} - true if next plugin is tried
   * @returns {boolean} - false if there are no pending plugins
   */
  async tryNext () {
    this.logger.info('Trying next plugin')
    if (!this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.internalState))
    if (!isEmptyObject(this.currentPlugin)) throw new Error(ERRORS.PLUGIN_IN_PROGRESS(this.currentPlugin.name))

    if (this.pendingPlugins.length === 0) return false

    this.currentPlugin = { name: this.pendingPlugins.shift(), startAt: Date.now(), state: PLUGIN_STATE.SUBMITTED }
    await this.payment.update()
    this.logger.debug(`Updated payment with next plugin ${this.currentPlugin.name}`)

    return true
  }

  /**
   * Complete payment - sets internal state to completed and updates payment in db
   * @throws {Error} - if current state is not in progress
   * @returns {void}
   */
  async complete () {
    this.logger.info(`Completing payment with plugin ${this.currentPlugin?.name}`)
    if (!this.isInProgress()) throw new Error(ERRORS.INVALID_STATE(this.internalState))

    this.completedByPlugin = this.markCurrentPluginAsTried(PLUGIN_STATE.SUCCESS)
    this.logger.debug(`Marked current plugin ${this.currentPlugin?.name} as tried with success state`)
    this.internalState = PAYMENT_STATE.COMPLETED
    await this.payment.update()
    this.logger.debug('Completed payment')
  }

  /**
   * Marks current plugin as tried and returns it
   * @returns {StatePlugin} - completed current plugin with endAt timestamp
   */
  markCurrentPluginAsTried (state) {
    this.logger.info(`Marking current plugin ${this.currentPlugin.name} as tried`)
    const completedPlugin = { ...this.currentPlugin, endAt: Date.now(), state }
    this.triedPlugins.push(completedPlugin)
    this.currentPlugin = null

    this.logger.debug('Marked current plugin as tried')
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

/**
 * @typedef {Object} PluginState
 * @property {string} SUBMITTED - submitted to plugin
 * @property {string} FAILED - failed by plugin
 * @property {string} SUCCESS - succeeded by plugin
 */
const PLUGIN_STATE = {
  SUBMITTED: 'submitted',
  FAILED: 'failed',
  SUCCESS: 'success'
}

/**
 * @typedef {Object} ERRORS
 * @property {function} INVALID_STATE - returns error message with invalid state
 * @property {string} PENDING_PLUGINS_NOT_ARRAY - error message for pending plugins not array
 * @property {function} PLUGIN_IN_PROGRESS - returns error message with plugin name
 * @property {string} PAYMENT_REQUIRED - error message for payment required
 * @property {string} DB_REQUIRED - error message for db required
 * @property {string} DB_NOT_READY - error message for db not ready
 */
const ERRORS = {
  INVALID_STATE: (s) => `Invalid state: ${s}`,
  PENDING_PLUGINS_NOT_ARRAY: 'Pending plugins must be an array',
  PLUGIN_IN_PROGRESS: (name) => `Cannot try next plugin while processing ${name}`,
  PAYMENT_REQUIRED: 'Payment required',
  DB_REQUIRED: 'DB required',
  DB_NOT_READY: 'DB not ready'
}

/**
 * typedef {StatePlugin}
 * @property {string} name - name of the plugin
 * @property {number} startAt - start time
 * @property {string} state - state of the plugin
 * @property {number} [endAt] - end time
 */

module.exports = {
  PaymentState,
  PAYMENT_STATE,
  PLUGIN_STATE,
  ERRORS
}
