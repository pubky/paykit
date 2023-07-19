const { LndConnect } = require('./LndConnect.js')

const pluginName = 'bolt11'

function getWatcher (config) {
  const lnd = new LndConnect(config)

  return async ({ amount, notificationCallback }) => {
    const outputs = {}

    const callback = async (receipt) => {
      await notificationCallback({
        pluginName,
        type: 'payment_new',
        data: receipt,
        amountWasSpecified: !!amount
        // TODO: extract from receipt
        // amount
        // networkId - use network id?
        // memo
      // amount: payload.amount, // send it in payload
      // memo: payload.memo || '', // send it in payload
      // denomination: payload.denomination || 'BASE',
      // currency: payload.currency || 'BTC',
      // clientOrderId: payload.networkId, // send in payload
      })
    }

    const invoice = await lnd.generateInvoice({ tokens: amount })
    outputs.bolt11 = invoice.data
    lnd.subscribeToInvoice(invoice.id, callback)

    await notificationCallback({
      id: invoice.id,
      pluginName,
      type: 'ready_to_receive',
      data: outputs,
      amountWasSpecified: !!amount
    })
  }
}

function getPayer (config) {
  const lnd = new LndConnect(config)

  // XXX bolt11 should be general common for all plugin names
  return async ({ bolt11, notificationCallback, amount = null }) => {
    const request = typeof bolt11 === 'string' ? bolt11 : bolt11.bolt11

    const res = await lnd.payInvoice({ request, tokens: amount })

    await notificationCallback({
      id: res.id,
      pluginName,
      type: '', // XXX
      pluginState: res.error ? 'failed' : 'success', // XXX do better
      data: res

      // XXX: needed by core:
    })
  }
}

module.exports = {
  getmanifest: () => {
    return {
      name: pluginName, // FIXME
      type: 'payment',
      description: 'Slashpay bitcoin l2 payments',
      rpc: ['pay'],
      events: ['receivePayment']
    }
  },
  init: (config) => {
    return {
      pay: getPayer(config),
      receivePayment: getWatcher(config)
    }
  }
}
