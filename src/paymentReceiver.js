class PaymentReceiver {
  constructor(config, pluginManager, db, storage, notificationCallback) {
    this.pluginManager = pluginManager
    this.config = config
    this.db = db // internal state
    this.storage = storage // public interface
    this.notificationCallback = notificationCallback
  }

  async init() {
    const paymentPluginNames = this.getListOfSupportedPaymentMethods()
    const slashpayFile = this.generateSlashpayContent(paymentPluginNames)
    const url = await this.storage.create('./slashpay.json', slashpayFile)

    // for now it is the same callback used for payment notifications
    // and for plugin status
    await this.pluginManager.dispatch('receivePayment', {
      // TODO: define payload to make plugins create their own slashpay files
      notificationCallback: this.notificationCallback,
    })

    // XXX what if some plugins failed to initialize?
    // we need some kind of a mechanism to track their readiness
    // this can be done via tracking list of plugins which were included into
    // slashpay.json file and return list as a result of this method
    // then each plugin should report its readiness via RPC notification endpoint

    paymentPluginNames.forEach((name) => {
      this.pluginManager.plugins[name].readyToReceivePayments = false
    })

    return url
  }

  generateSlashpayContent(paymentPluginNames) {
    const slashpayFile = { supportedPaymentMethods: [] }

    paymentPluginNames.forEach((name) => {
      slashpayFile.supportedPaymentMethods.push({
        path: path.join('slashpay', name, 'slashpay.json'),
      })
    })

    return slashpayFile
  }

  getListOfSupportedPaymentMethods() {
    return this.pluginManager
      .plugins
      .filer(({ manifest, active }) => active && manifest.type === 'payment')
      .map(({ manifest }) => manifest.name)
  }
}

module.exports = {
  PaymentReceiver,
}

