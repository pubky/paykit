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
        rawData: receipt.data,

        isPersonalPayment: !!amount,

        amount: receipt.data.received.toString(),
        denomination: 'BASE',
        currency: 'BTC',

        memo: receipt.data.description,

        clientOrderId: receipt.data.id,

        createdAt: receipt.data.created_at,
        confirmedAt: receipt.data.confirmed_at
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
      isPersonalPayment: !!amount
    })
  }
}

function getPayer (config) {
  const lnd = new LndConnect(config)

  return async ({ target, payload, notificationCallback }) => {
    const request = typeof target === 'string' ? target : target.bolt11
    // const payload = {
    //  id: serialized.id, // for identification upon feedback
    //  orderId: serialized.orderId, // for identification upon feedback
    //  memo: serialized.memo, // memo - nice to have
    //  amount: serialized.amount,
    //  currency: serialized.currency,
    //  denomination: serialized.denomination
    // }

    // TODO: convert amount based on denomination
    // TODO: validate currency
    const res = await lnd.payInvoice({ request, tokens: payload.amount })
    await notificationCallback({
      ...payload,
      pluginName,
      pluginState: res.error ? 'failed' : 'success', // XXX do better?
      rawData: res
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
