class Storage {
  constructor(target) {
    this.target = target
  }

  async init () { }

  async getPaymentFile () {
    return {
      paymentEndpoints: {
        'p2sh': './p2sh/slashpay.json',
        'p2sh-p2wsh': './p2sh-p2wsh/slashpay.json',
        'p2wsh': './p2wsh/slashpay.json',
        'p2tr': './p2tr/slashpay.json',
        'lightning': './lightning/slashpay.json'
      }
    }
  }

  async getFile (_path) {
    return {
      'target': 'testPaymentAddressOrLightningInvoice',
    }
  }

}

module.exports = {
  Storage
}
