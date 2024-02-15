function getWatcher (config) {
  return async ({ id, clientOrderId, expectedAmount, notificationCallback, receiverCallback }) => {
    const callback = async (receipt) => {
      await notificationCallback({
        id, // paykit id
        clientOrderId, // optional customer generated id

        pluginName: output.pluginName,
        type: 'payment_new',
        rawData: receipt.data,

        isPersonalPayment: !!expectedAmount,

        amount: receipt.data.received.toString(),
        denomination: expectedAmount.denomination,
        currency: expectedAmount.currency,

        state: receipt.data.is_confirmed || receipt.data.tokens ? 'success' : 'failed',

        memo: receipt.data.description,

        networkId: receipt.data.id,

        createdAt: receipt.data.created_at,
        confirmedAt: receipt.data.confirmed_at
      })
    }

    const outputs = receiverCallback(expectedAmount, config, callback)

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
  return async ({ target, payload, notificationCallback, senderCallback }) => {
    const res = senderCallback(target, payload.amount, config)

    await notificationCallback({
      ...res,
      pluginName: res.pluginName,
      pluginState: res.error ? 'failed' : 'success', // XXX do better?
      rawData: res
    })
  }
}

module.exports = {
  getmanifest: (name) => {
    return {
      name,
      type: 'payment',
      description: 'Paykit pass through plugin',
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
