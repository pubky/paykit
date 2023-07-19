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

  return async ({ address, amount, notificationCallback }) => {
    let target
    if (typeof address === 'string') {
      target = address
    } else {
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
