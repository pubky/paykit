const path = require('path')
/**
 * PaymentReceiver is a class which is responsible for making plugins to receive payments
 * @class PaymentReceiver
 */
class PaymentReceiver {
  /**
   * @constructor PaymentReceiver
   * @param {DB} db - instance of a database
   * @param {RemoteStorage} storage - instance of a local storage (e.g. HyperDrive)
   * @param {Function} notificationCallback - callback which is called when payment is received
   */
  constructor (db, pluginManager, storage, notificationCallback) {
    this.db = db // internal state storage
    this.storage = storage // internal public interface
    this.notificationCallback = notificationCallback
    this.pluginManager = pluginManager
  }

  /**
   * Initialize, get ready to receive payments at returned URL
   * @returns {Promise<String>} - url to local drive where slashpay.json file is located
   */
  async init () {
    const paymentPluginNames = this.getListOfSupportedPaymentMethods()
    const slashpayFile = this.generateSlashpayContent(paymentPluginNames)
    const url = await this.storage.create('./slashpay.json', slashpayFile)

    // for now it is the same callback used for payment notifications
    // and for plugin status
    await this.pluginManager.dispatchEvent('receivePayment', {
      // TODO: define payload to make plugins create their own slashpay files
      notificationCallback: async (payload) => {
        await this.db.savePayment(payload)
        this.notificationCallback(payload)
      }
    })

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
   * @method generateSlashpayContent
   * @param {Array<String>} paymentPluginNames - list of payment plugin names
   * @returns {Object} - content of slashpay.json file
   */
  generateSlashpayContent (paymentPluginNames) {
    const slashpayFile = { paymentEndpoints: {} }
    paymentPluginNames.forEach(n => slashpayFile.paymentEndpoints[n] = path.join('slashpay', n, 'slashpay.json'))

    return slashpayFile
  }

  /**
   * @method getListOfSupportedPaymentMethods
   * @returns {Array<String>} - list of payment plugin names
   */
  getListOfSupportedPaymentMethods () {
    return Object.entries(this.pluginManager.plugins)
      .filter(([_name, { manifest, active }]) => active && manifest.type === 'payment')
      .map(([name, _plugin]) => name)
  }
}

module.exports = {
  PaymentReceiver
}
