const config = require('./config.js')
const { LndConnect } = require('./LndConnect.js')

const pluginName = 'bolt11'

function getWatcher (config) {
  const lnd = config.config ? config : new LndConnect(config)

  return async ({ amount, notificationCallback }) => {
    const outputs = {}

    const callback = async (receipt) => {
      await notificationCallback({
        pluginName,
        type: 'payment_new',
        data: receipt,
        amountWasSpecified: !!amount,
      })
    }

    const invoice = await lnd.generateInvoice({ tokens: amount })
    outputs['bolt11'] = invoice.data
    lnd.subscribeToInvoice(invoice.id, callback)

    await notificationCallback({
      id: invoice.id,
      pluginName,
      type: 'ready_to_recieve',
      data: outputs,
      amountWasSpecified: !!amount,
    })
  }
}

function getPayer (config) {
  const lnd = config.config ? config : new LndConnect(config)

  return async ({ bolt11, notificationCallback, amount = null }) => {
    const res = await lnd.payInvoice({ request: bolt11, tokens: amount })
    console.log('res', res.error)

    // XXX what again do I need here?
    await notificationCallback({
      id: res.id,
      pluginName,
      type: '', // XXX
      pluginState: res.error ? 'failed' : 'success', // XXX do better
      data: res,
    })
  }
}

module.exports = {
  getmanifest: () => {
    return {
      name: pluginName, // FIXME
      type: 'payment',
      description: 'Slashpay bitcoin l2 payments',
      rpc: ['pay', 'start'],
      events: ['watch']
    }
  },
  pay: getPayer(config),
  watch: getWatcher(config),
}
