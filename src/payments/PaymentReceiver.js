const path = require('path')
const { v4: uuidv4 } = require('uuid')

const { PaymentObject, PAYMENT_DIRECTION, PAYMENT_STATE } = require('./PaymentObject')
const { SLASHPAY_PATH } = require('../slashtags')
/**
 * PaymentReceiver is a class which is responsible for making plugins to receive payments
 * @class PaymentReceiver
 */
class PaymentReceiver {
  /**
   * @constructor PaymentReceiver
   * @param {DB} db - instance of a database
   * @param {PluginManager} pluginManager - instance of a plugin manager
   * @param {RemoteStorage} storage - instance of a local storage (e.g. HyperDrive)
   * @param {Function} notificationCallback - callback which is called when payment is received
   */
  constructor (db, pluginManager, storage, notificationCallback) {
    this.db = db // internal state storage
    this.storage = storage // internal public interface
    this.notificationCallback = notificationCallback
    this.pluginManager = pluginManager
    this.ready = false
  }

  /**
   * Initialize, get ready to receive payments at returned URL
   * @param {PaymentAmount} [amount] - amount of money to receive
   * @returns {Promise<String>} - url to local drive where slashpay.json file is located
   */
  async init () {
    const paymentPluginNames = this.getListOfSupportedPaymentMethods()
    const { id, slashpayFile } = await this.generateSlashpayContent(paymentPluginNames)
    const url = await this.storage.create(SLASHPAY_PATH, slashpayFile, { awaitRelaySync: true })

    const payload = { id, notificationCallback: this.notificationCallback.bind(this) }

    //TODO: create paymentFile after the event was dispatched and processed(!)
    // thus make process waiting for relay to sync
    await this.pluginManager.dispatchEvent('receivePayment', payload)

    // XXX what if some plugins failed to initialize?
    // we need some kind of a mechanism to track their readiness
    // this can be done via tracking list of plugins which were included into
    // slashpay.json file and return list as a result of this method
    // then each plugin should report its readiness via RPC notification endpoint
    // paymentPluginNames.forEach((name) => {
    //   this.pluginManager.plugins[name].readyToReceivePayments = false
    // })

    this.ready = true

    return url
  }

  /**
   * Initialize, get ready to receive payments at returned URL
   * @param {string} id - invoice id
   * @param {PaymentAmount} amount - amount of money to receive
   * @returns {Promise<String>} - url to local drive where slashpay.json file is located
  */
  async createInvoice (id, amount) {
    if (!this.ready) throw new Error(ERRORS.PAYMENT_RECEIVER_NOT_READY)

    const paymentPluginNames = this.getListOfSupportedPaymentMethods()
    const { slashpayFile } = await this.generateSlashpayContent(paymentPluginNames, id)
    // FIXME: decryption key
    const url = await this.storage.create(SLASHPAY_PATH, slashpayFile)

    const payload = { id, notificationCallback: this.notificationCallback.bind(this) }
    payload.amount = amount.serialize()

    await this.pluginManager.dispatchEvent('receivePayment', payload)

    // XXX what if some plugins failed to initialize?
    // we need some kind of a mechanism to track their readiness
    // this can be done via tracking list of plugins which were included into
    // slashpay.json file and return list as a result of this method
    // then each plugin should report its readiness via RPC notification endpoint
    // paymentPluginNames.forEach((name) => {
    //   this.pluginManager.plugins[name].readyToReceivePayments = false
    // })


    return url
  }

  /**
   * Sotres payload data in to file
   */
  async createPaymentFile (payload) {
    if (!payload.isPersonalPayment) {
      const path = `public/slashpay/${payload.pluginName}/slashpay.json`
      await this.storage.create(path, payload.data, { awaitRelaySync: true })
    } else {
      // FIXME (encrypt if personal payment and do not store under public path)
      throw new Error('Personal payements are not yet supported')
    }
  }

  /**
   * Callback which is called by plugin when payment is received
   * @param {Object} payload - payment object
   * @returns {Promise<void>}
   */
  async handleNewPayment (payload, regenerateSlashpay = true) {
    const paymentObject = new PaymentObject({
      orderId: uuidv4(),
      sendingPriority: [payload.pluginName],
      direction: PAYMENT_DIRECTION.IN,
      internalState: PAYMENT_STATE.COMPLETED,

      counterpartyURL: await this.storage.getUrl(), // we cant really know this so it may always be receiver

      completedByPlugin: {
        name: payload.pluginName,
        state: 'success', // XXX should I read it from plugin?
        startAt: Date.now(),
        endAt: Date.now()
      },

      // FROM PAYLOAD
      amount: payload.amount, // send it in payload
      memo: payload.memo || '', // send it in payload
      denomination: payload.denomination || 'BASE',
      currency: payload.currency || 'BTC',
      clientOrderId: payload.clientOrderId // send in payload
    }, this.db)
    await paymentObject.save()

    if (regenerateSlashpay) {
      await this.init()
    }

    await this.notificationCallback(paymentObject)
  }

  /**
   * @method generateSlashpayContent
   * @param {Array<String>} paymentPluginNames - list of payment plugin names
   * @param {PaymentAmount} [amount] - amount of money to receive
   * @returns {Object} - content of slashpay.json file
   */
  async generateSlashpayContent (paymentPluginNames, id = uuidv4()) {
    const slashpayFile = { paymentEndpoints: {} }

    for (let name of paymentPluginNames) {
      slashpayFile.paymentEndpoints[name] = await this.storage.getUrl(path.join('/public/slashpay', name, 'slashpay.json'))
    }

    return {
      slashpayFile,
      id
    }
  }

  /**
   * @method updateSlashpayContent
   * @param {String} id - invoice id
   */
  async updateSlashpayContent(paymentPluginNames, id) {
    // TODO: read current content of slashpay.json
    const slashpayFile = { paymentEndpoints: {} }

    for (let name of paymentPluginNames) {
      slashpayFile.paymentEndpoints[name] = await this.storage.getUrl(path.join('/', id, 'slashpay', name, 'slashpay.json'))
    }

    return {
      slashpayFile,
      id
    }
  }

  /**
   * @method getListOfSupportedPaymentMethods
   * @returns {Array<String>} - list of payment plugin names
   */
  getListOfSupportedPaymentMethods () {
    return Object.entries(this.pluginManager.getPlugins(true))
      .filter(([_name, { manifest }]) => manifest.type === 'payment')
      .map(([name, _plugin]) => name)
  }
}

const ERRORS = {
  PAYMENT_RECEIVER_NOT_READY: 'PAYMENT_RECEIVER_NOT_READY'
}

module.exports = {
  PaymentReceiver,
  ERRORS
}
