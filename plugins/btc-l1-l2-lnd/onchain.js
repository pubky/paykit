const config = require('./config.js')
const { LndConnect } = require('./LndConnect.js')

const pluginName = 'onchain'

// read from config instead?
// const supportedMethods = ['p2wpkh', 'p2pkh']
const supportedMethods = ['p2wpkh']

function getWatcher (config) {
  const lnd = config.config ? config : new LndConnect(config)

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
      type: 'ready_to_recieve',
      data: outputs,
      amountWasSpecified: !!amount
    })
  }
}

function getPayer (config) {
  const lnd = config.config ? config : new LndConnect(config)

  return async ({ address, amount, notificationCallback }) => {
    const res = await lnd.sendOnChainFunds({
      address, tokens: amount
    })

    console.log(res.error)

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
  init: () => {
    console.log(pluginName, 'init')

    return {
      pay: getPayer(config),
      receivePayment: getWatcher(config)
    }
  },
}
