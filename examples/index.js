const readline = require('readline')

const { SlashtagsConnector } = require('../src/slashtags')
const { PaymentManager } = require('../src/payments/PaymentManager')
const { DB } = require('../src/DB') // mocked

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
    bolt11: pluginConfig,
    onchain: pluginConfig
  }

  const slashtagsConnector = new SlashtagsConnector()
  await slashtagsConnector.init()
  const db = new DB()
  await db.init()

  const paymentManager = new PaymentManager(
    slashpayConfig,
    db,
    slashtagsConnector,
    (p) => console.log('--- nofication: ', p)
  )

  await paymentManager.init() // receiver
  const myUrl = await paymentManager.receivePayments()

  console.log('ready to receive payments at:', myUrl)

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
    await slashtagsConnector.close()
    // XXX: stop plugins shutting down the subscriptions to addresses and invoices
    process.exit(0)
  })
})()
