const { test } = require('brittle')
const config = require('../config.js')

const { LndConnect } = require('../LndConnect')

test('LndConenct.getWalletInfo', async t => {
  const lnd = new LndConnect(config)

  const res = await lnd.getWalletInfo()
  t.absent(res.error)
  t.absent(res.id)
  t.ok(res.data.chains.length)
  t.ok(res.data.color)
  t.ok(res.data.active_channels_count)
  t.ok(res.data.features.length)
  t.ok(Date.parse(res.data.latest_block_at) <= Date.now())
  t.ok(res.data.public_key)
  t.ok(res.data.version)
})

test('LndConnect.generateInvoice', async t => {
  const lnd = new LndConnect(config)

  const res = await lnd.generateInvoice({ tokens: 100, description: 'test' })
  t.absent(res.error)
  t.ok(res.id)
  t.ok(res.data)
  t.ok(res.data.startsWith('ln'))
})

test('LndConnect.payInvoice', async t => {
  // TODO
})

test('LndConnect.sendOnchainFungs', async t => {
  // TODO
})

test('LndConnect.generateAddress', async t => {
  const lnd = new LndConnect(config)

  let res
  res = await lnd.generateAddress()
  t.absent(res.error)
  t.ok(res.id)
  t.ok(res.data)
  t.ok(res.data.startsWith('bc'))
  t.is(res.data, res.id)

  res = await lnd.generateAddress('p2tr')
  t.absent(res.error)
  t.ok(res.id)
  t.ok(res.data)
  t.ok(res.data.startsWith('bc'))
  t.is(res.data.length, 62 + 2) //???
  t.is(res.data, res.id)

  res = await lnd.generateAddress('np2wpkh')
  t.absent(res.error)
  t.ok(res.id)
  t.ok(res.data)
  t.ok(res.data.startsWith('2'))
  t.is(res.data, res.id)

  res = await lnd.generateAddress('p2wpkh')
  t.absent(res.error)
  t.ok(res.id)
  t.ok(res.data)
  t.ok(res.data.startsWith('bc'))
  t.is(res.data.length, 42 + 2) //???
  t.is(res.data, res.id)
})

test('LndConnect.subscribeToInvoices', async t => {
  // TODO
})

test('LndConnect.subscribeToAddress', async t => {
  // TODO
})

test('LndConnect.getSupportedMethods', async t => {
  const lnd = new LndConnect(config)

  const methods = [...config.SUPPORTED_METHODS, 'foo']
  const supported = lnd.getSupportedMethods(methods)
  t.is(supported.length, 4)
  t.alike(supported, config.SUPPORTED_METHODS)
})

test('LndConnect.runMethod', async t => {
  // TODO
})

test('LndConnect.runSubscribe', async t => {
  // TODO
})
