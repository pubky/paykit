const readline = require('readline')

const { PaymentManager } = require('../src/payments/PaymentManager')
const qrcode = require('qrcode-terminal')

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
      slashtags: { relay: 'http://localhost:3000' } // TODO: staging config
    },
    notificationCallback: (p) => console.log('--- nofication: ', p)
  })

  console.log('initializing...')
  await paymentManager.init() // receiver
  console.log('initialized')
  console.log('initializging receivers...')
  const myUrl = await paymentManager.receivePayments()

  console.log('ready to receive payments at:')
  qrcode.generate(myURL, { small: true })
  console.log('send', myUrl, '1000')
  console.log('')

  console.log('to send payments paste <slashpayURL> <amount>')

  rl.on('line', async (line) => {
    const [command, url, amount] = line.split(' ')
    if (command === 'send') {
      await sendPayment(url, amount)
    } else if (command === 'receive') {
      await createInvoice(url || amount)
    } else {
      console.log('unknown command')
    }
  })

  rl.on('close', async () => {
    console.log('bye')
    // XXX: stop plugins shutting down the subscriptions to addresses and invoices
    process.exit(0)
  })

  async function sendPayment (counterpartyURL, amount) {
    const paymentOrder = await paymentManager.createPaymentOrder({
      clientOrderId: Date.now(),
      amount,
      sendingPriority: ['bolt11', 'onchain'],
      counterpartyURL
    })

    await paymentManager.sendPayment(paymentOrder.id)
  }

  async function createInvoice (amount) {
    const invoiceURL = await paymentManager.createInvoice((new Date()).getTime(), amount)
    console.log('Ask to pay this:')
    qrcode.generate(invoiceURL, { small: true })
    console.log(invoiceURL, amount)
  }
})()
