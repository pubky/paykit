const { LndConnect } = require('./LndConnect.js')

const pluginName = 'onchain'

const supportedMethods = ['p2wpkh']

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
        // amount // always use base denomination
        // networkId - use network id?
        // memo
      // amount: payload.amount, // send it in payload
      // memo: payload.memo || '', // send it in payload
      // denomination: payload.denomination || 'BASE',
      // currency: payload.currency || 'BTC',
      // clientOrderId: payload.networkId, // send in payload
      })
    }

    for (let i = 0; i < supportedMethods.length; i++) {
      const method = supportedMethods[i]
      const address = await lnd.generateAddress(method) // TODO: support amount?
      outputs[method] = address.data
      await lnd.subscribeToAddress(address.data, method, callback)
    }

    await notificationCallback({
      pluginName,
      type: 'ready_to_receive',
      data: outputs,
      amountWasSpecified: !!amount
    })
  }
}

function getPayer (config) {
  const lnd = new LndConnect(config)

  // XXX address should be general common for all plugin names
  return async ({ address, amount, notificationCallback }) => {
    let target
    if (typeof address === 'string') {
      target = address
    } else {
      // XXX: this is a hack, will always send to first address, no biggie but
      // some heuristic would not hurt
      target = Object.values(address)[0]
    }

    const res = await lnd.sendOnChainFunds({
      address: target, tokens: amount
    })

    // XXX what again do I need here?
    await notificationCallback({
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
      description: 'Slashpay bitcoin l1 payments',
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
