const { test } = require('brittle')
const config = require('../config.js')
const configBob = require('../config.bob.js')

const { LndConnect } = require('../LndConnect')

test('LndConenct.getWalletInfo', async t => {
  const lnd = new LndConnect(config)

  const res = await lnd.getWalletInfo()
  t.absent(res.error)
  t.absent(res.id)
  t.ok(res.data.chains.length)
  t.ok(res.data.color)
  t.ok(res.data.active_channels_count >= 0)
  t.ok(res.data.features.length)
  t.ok(Date.parse(res.data.latest_block_at) <= Date.now())
  t.ok(res.data.public_key)
  t.ok(res.data.version)
})

test('LndConnect.generateInvoice, LndConnect.subscribeToInvoice, LndConnect.payInvoice', async t => {
  const tokens = 2
  const description = 'test'

  t.plan(25)
  t.timeout(60000)

  const alice = new LndConnect(config)
  const resAlice = await alice.generateInvoice({ tokens, description })
  t.absent(resAlice.error)
  t.ok(resAlice.id)
  t.ok(resAlice.data)
  t.ok(resAlice.data.startsWith('ln'))

  await alice.subscribeToInvoice(resAlice.id, (receip) => {
    t.ok(receip)
    t.absent(receip.error)
    t.ok(receip.data)
    t.ok(Date.parse(receip.timestamp) <= Date.now())
    t.ok(receip.data.id)
    t.is(receip.data.sats, tokens)
    t.is(receip.data.description, description)
    t.pass()
  })

  const bob = new LndConnect(configBob)
  const resBob = await bob.payInvoice({ request: resAlice.data })

  t.absent(resBob.error)
  t.ok(resBob.id)
  t.ok(resBob.data)
  t.ok(Date.parse(resBob.data.confirmed_at) <= Date.now())
  t.ok(resBob.data.hops.length)
  t.ok(resBob.data.id)
  t.is(resBob.data.id, resBob.id)
  t.ok(resBob.data.is_confirmed)
  t.ok(resBob.data.is_outgoing)
  t.is(resBob.data.mtokens.toString(), (tokens * 1000).toString())
  t.ok(resBob.data.paths.length)
  t.ok(resBob.data.secret)
  t.is(resBob.data.tokens, tokens)
})

test('LndConnect.generateAddress, LndConnect.subscribeToAddress, LndConnect.sendOnchainFunds', async t => {
  const lndAlice = new LndConnect(config)
  t.plan(35)
  t.timeout(60000)

  let res
  res = await lndAlice.generateAddress()
  t.absent(res.error)
  t.ok(res.id)
  t.ok(res.data)
  t.ok(res.data.startsWith('bc'))
  t.is(res.data, res.id)

  res = await lndAlice.generateAddress('p2tr')
  t.absent(res.error)
  t.ok(res.id)
  t.ok(res.data)
  t.ok(res.data.startsWith('bc'))
  t.is(res.data.length, 62 + 2) // ???
  t.is(res.data, res.id)

  res = await lndAlice.generateAddress('np2wpkh')
  t.absent(res.error)
  t.ok(res.id)
  t.ok(res.data)
  t.ok(res.data.startsWith('2'))
  t.is(res.data, res.id)

  res = await lndAlice.generateAddress('p2wpkh')
  t.absent(res.error)
  t.ok(res.id)
  t.ok(res.data)
  t.ok(res.data.startsWith('bc'))
  t.is(res.data.length, 42 + 2) // ???
  t.is(res.data, res.id)

  const tokens = 1000

  lndAlice.subscribeToAddress(res.data, 'p2wpkh', (receip) => {
    t.ok(receip)
    t.absent(receip.error)
    t.ok(receip.data)
    t.ok(Date.parse(receip.timestamp) <= Date.now())
    t.pass()
  })

  const lndBob = new LndConnect(configBob)
  const resBob = await lndBob.sendOnChainFunds({ address: res.data, tokens })
  t.absent(resBob.error)
  t.ok(resBob.id)
  t.ok(resBob.data)
  t.ok(resBob.data.confirmation_count >= 0)
  t.ok(resBob.data.id)
  t.is(resBob.data.is_confirmed, false)
  t.ok(resBob.data.is_outgoing)
  t.is(resBob.data.tokens, tokens)
})

test('LndConnect.getSupportedMethods', async t => {
  const lnd = new LndConnect(config)

  const methods = [...config.SUPPORTED_METHODS, 'foo']
  const supported = lnd.getSupportedMethods(methods)
  t.is(supported.length, 4)
  t.alike(supported, config.SUPPORTED_METHODS)
})
