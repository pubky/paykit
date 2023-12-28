const { LndConnect } = require('./LndConnect.js')

const pluginName = 'onchain'

const supportedMethods = ['p2wpkh']

function getWatcher (config) {
  const lnd = new LndConnect(config)

  return async ({ id, reference, amount, notificationCallback }) => {
    const outputs = {}

    const callback = async (receipt) => {
      await notificationCallback({
        id, // slashpay id
        reference, // optional customer generated id

        pluginName,
        type: 'payment_new',
        rawData: receipt.data,
        isPersonalPayment: !!amount,

        // TODO: handle amount
        // by decoding receipt.data.transaction
        // {
        //   block: <Block Hash Hex String>
        //   height: <Block Best Chain Height Number>
        //   transaction: <Raw Transaction Hex String>
        // }
        state: 'success', // works on confirmation but not on reorgs

        currency: 'BTC',
        denomination: 'BASE',

        clientOrderId: receipt.data.transaction,
        amount: '1000', // XXX after processing tx
        memo: ''
      })
    }

    for (let i = 0; i < supportedMethods.length; i++) {
      const method = supportedMethods[i]
      const address = await lnd.generateAddress(method) // TODO: support amount?
      outputs[method] = address.data
      await lnd.subscribeToAddress(address.data, method, callback)
    }

    await notificationCallback({
      id,
      reference,
      // TODO:
      // networkid: address?

      pluginName,

      type: 'ready_to_receive',
      data: outputs,

      isPersonalPayment: !!amount
    })
  }
}

function getPayer (config) {
  const lnd = new LndConnect(config)

  // XXX address should be general common for all plugin names
  return async ({ target, payload, notificationCallback }) => {
    let address
    if (typeof target === 'string') {
      address = target
    } else {
      // XXX: this is a hack, will always send to first address, no biggie but
      // some heuristic would not hurt
      address = Object.values(target)[0]
    }

    // const payload = {
    //  id: serialized.id, // for identification upon feedback
    //  orderId: serialized.orderId, // for identification upon feedback
    //  memo: serialized.memo, // memo - nice to have
    //  amount: serialized.amount,
    //  currency: serialized.currency,
    //  denomination: serialized.denomination
    // }

    const res = await lnd.sendOnChainFunds({
      address, tokens: parseInt(payload.amount)
    })

    // XXX what again do I need here?
    await notificationCallback({
      ...payload,
      pluginName,
      pluginState: res.error ? 'failed' : 'success', // XXX do better?
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
