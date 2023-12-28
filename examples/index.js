const readline = require('readline')

const { PaymentManager } = require('../src/payments/PaymentManager')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const bolt11 = require('../plugins/btc-l1-l2-lnd/bolt11.js')
const onchain = require('../plugins/btc-l1-l2-lnd/onchain.js')

;(async () => {
  const pluginConfig = require(process.argv[2])
  const slashpayConfig = {
    sendingPriority: ['bolt11', 'onchain'],
    plugins: {
      bolt11,
      onchain
    },
    bolt11: pluginConfig.plugin,
    onchain: pluginConfig.plugin
  }

  const paymentManager = new PaymentManager({
    config: {
      slashpay: slashpayConfig,
      db: pluginConfig.db,
      slashtags: { relay: 'http://localhost:3000' }
    },
    notificationCallback: (p) => console.log('--- nofication: ', p)
  })

  console.log('initializing...')
  await paymentManager.init() // receiver
  console.log('initialized')
  console.log('initializging receivers...')
  const myUrl = await paymentManager.receivePayments()


  console.log('ready to receive payments at:')
  console.log(myUrl, '100')
  console.log('')

  console.log('to send payments paste <slashpayURL> <amount>')

  rl.on('line', async (line) => {
    const [url, amount] = line.split(' ')
    const paymentOrder = await paymentManager.createPaymentOrder({
      clientOrderId: Date.now(),
      amount,
      sendingPriority: [
        'bolt11',
        'onchain'
      ],
      counterpartyURL: url
    })

    await paymentManager.sendPayment(paymentOrder.id)
  })

  rl.on('close', async () => {
    console.log('bye')
    // XXX: stop plugins shutting down the subscriptions to addresses and invoices
    process.exit(0)
  })
})()
