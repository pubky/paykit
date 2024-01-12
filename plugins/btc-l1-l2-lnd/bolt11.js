const { LndConnect } = require('./LndConnect.js')

const pluginName = 'bolt11'

function getWatcher (config) {
  const lnd = new LndConnect(config)

  return async ({ id, clientOrderId, expectedAmount, notificationCallback }) => {
    const outputs = {}

    const callback = async (receipt) => {
      await notificationCallback({
        id, // paykit id
        clientOrderId, // optional customer generated id

        pluginName,
        type: 'payment_new',
        rawData: receipt.data,

        isPersonalPayment: !!expectedAmount,

        amount: receipt.data.received.toString(),
        denomination: 'BASE',
        currency: 'BTC',

        state: receipt.data.is_confirmed || receipt.data.tokens ? 'success' : 'failed',

        memo: receipt.data.description,

        networkId: receipt.data.id,

        createdAt: receipt.data.created_at,
        confirmedAt: receipt.data.confirmed_at
      })
    }

    let tokens
    if (expectedAmount) {
      tokens = expectedAmount.amount
    }

    const invoice = await lnd.generateInvoice({ tokens })
    outputs.bolt11 = invoice.data
    lnd.subscribeToInvoice(invoice.id, callback)

    const readyToReceive = {
      id,
      clientOrderId,

      // TODO:
      // networkid: invice.id

      pluginName,

      type: 'ready_to_receive',
      data: outputs,
      expectedAmount,

      isPersonalPayment: !!expectedAmount
    }
    await notificationCallback(readyToReceive)
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
