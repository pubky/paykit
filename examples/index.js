const readline = require('readline')

const Paykit = require('../index')
const qrcode = require('qrcode-terminal')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

;(async () => {
  const config = require(process.argv[2])

  const paymentManager = new Paykit({
    config,
    notificationCallback: (p) => console.log('--- nofication: ', p)
  })

  console.log('initializing...')
  await paymentManager.init() // receiver
  console.log('initialized')
  console.log('initializing receivers...')
  const myUrl = await paymentManager.receivePayments()

  console.log('ready to receive payments at:')
  qrcode.generate(myUrl, { small: true })
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
      amount, // TODO: extend with fee etc
      counterpartyURL
    })

    await paymentManager.sendPayment(paymentOrder.id)
  }

  async function createInvoice (amount) {
    const id = (new Date()).getTime()
    const invoiceURL = await paymentManager.createInvoice({ clientOrderId: id,  amount })
    console.log('Ask to pay this:')
    qrcode.generate(invoiceURL, { small: true })
    console.log(invoiceURL, amount)
  }
})()
