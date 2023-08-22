const { test } = require('brittle')

const { SlashtagsConnector, ERRORS, SLASHPAY_PATH } = require('../../src/slashtags/index.js')

const { tmpdir, sleep } = require('../helpers')

const { Relay } = require('@synonymdev/web-relay')

test('SlashtagsConnector.validate', async t => {
  t.exception(() => SlashtagsConnector.validate(), ERRORS.INVALID_JSON)
  t.exception(() => SlashtagsConnector.validate(null), ERRORS.INVALID_JSON)
  t.exception(() => SlashtagsConnector.validate(''), ERRORS.INVALID_JSON)
  t.exception(() => SlashtagsConnector.validate('test'), ERRORS.INVALID_JSON)
  t.exception(() => SlashtagsConnector.validate(1), ERRORS.INVALID_JSON)
  t.exception(() => SlashtagsConnector.validate(true), ERRORS.INVALID_JSON)
  t.exception(() => SlashtagsConnector.validate(false), ERRORS.INVALID_JSON)
  t.exception(() => SlashtagsConnector.validate([]), ERRORS.INVALID_JSON)
  t.exception(() => SlashtagsConnector.validate({}), ERRORS.INVALID_JSON)

  t.execution(() => SlashtagsConnector.validate({ test: 'test' }))
})

test('SlashtagsConnector.getUrl', async t => {
  const slashtagsConnector = new SlashtagsConnector()
  const url = await slashtagsConnector.getUrl()

  t.ok(url.startsWith('slash'))

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.create', async t => {
  const slashtagsConnector = new SlashtagsConnector()

  await t.exception(async () => await slashtagsConnector.create(), ERRORS.INVALID_JSON)

  const path = '/public/foo.json'
  const url = await slashtagsConnector.create(path, { test: 'test' })

  // WHY '#' ????
  t.ok(url.startsWith('slash') && url.endsWith('/public/foo.json#'))

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.readLocal - default path', async t => {
  const slashtagsConnector = new SlashtagsConnector()

  const path = SLASHPAY_PATH
  const stored = { test: 'test' }
  await slashtagsConnector.create(path, stored)

  const read = await slashtagsConnector.readLocal()
  t.alike(read, stored)

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.readLocal - non-default path', async t => {
  const slashtagsConnector = new SlashtagsConnector()

  const path = '/foo.json'

  const stored = { test: 'test' }
  await slashtagsConnector.create(path, stored)

  const read = await slashtagsConnector.readLocal(path)
  t.alike(read, stored)

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.readRemote - default path', async t => {
  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const slashtagsConnectorReader = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  const slashtagsConnectorWriter = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  await t.exception(async () => await slashtagsConnectorReader.readRemote(), ERRORS.INVALID_URL)

  const stored = { test: 'test' }
  const source = await slashtagsConnectorWriter.create(SLASHPAY_PATH, stored)

  const read = await slashtagsConnectorReader.readRemote(source)
  t.alike(read, stored)

  t.teardown(async () => {
    await relay.close()
  })
})

test('SlashtagsConnector.readRemote - non-default public path', async t => {
  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const slashtagsConnectorReader = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  const slashtagsConnectorWriter = new SlashtagsConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  const path = '/public/foo.json'
  const stored = { test: 'test' }
  const urlPath = await slashtagsConnectorWriter.create(path, stored)

  await sleep(100)

  const read = await slashtagsConnectorReader.readRemote(urlPath)
  t.alike(read, stored)

  t.teardown(async () => {
    await relay.close()
  })
})

test('SlashtagsConnector.update', async t => {
  const slashtagsConnector = new SlashtagsConnector()

  const path = '/public/foo.json'
  const stored = { test: 'test' }
  await slashtagsConnector.create(path, stored)

  const read = await slashtagsConnector.readLocal(path)
  t.alike(read, stored)

  const updated = { test: 'updated' }
  await slashtagsConnector.update(path, updated)

  const readAgain = await slashtagsConnector.readLocal(path)
  t.alike(readAgain, updated)

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.delete - index', async t => {
  const slashtagsConnector = new SlashtagsConnector()

  const indexPath = SLASHPAY_PATH
  const paymentPath = '/public/test.json'

  await t.exception(async () => await slashtagsConnector.delete(indexPath), ERRORS.INDEX_NOT_FOUND)

  const indexFile = { paymentEndpoints: { test: paymentPath } }
  await slashtagsConnector.create(indexPath, indexFile)

  const paymentFile = { test: 'test' }
  await slashtagsConnector.create(paymentPath, paymentFile)

  const readIndex = await slashtagsConnector.readLocal(indexPath)
  t.alike(readIndex, indexFile)

  const readPayment = await slashtagsConnector.readLocal(paymentPath)
  t.alike(readPayment, paymentFile)

  await slashtagsConnector.delete()

  const readIndexDeleted = await slashtagsConnector.readLocal(indexPath)
  t.alike(readIndexDeleted, null)

  const readPaymentDeleted = await slashtagsConnector.readLocal(paymentPath)
  t.alike(readPaymentDeleted, null)

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.delete - payment file', async t => {
  const slashtagsConnector = new SlashtagsConnector()

  let readIndex
  const indexPath = SLASHPAY_PATH

  const paymentAPath = '/public/testA.json'
  const paymentAFile = { testA: 'testA' }
  let readPaymentA

  const paymentBPath = '/public/testB.json'
  const paymentBFile = { testB: 'testB' }

  await t.exception(async () => await slashtagsConnector.delete(indexPath), ERRORS.INDEX_NOT_FOUND)

  await slashtagsConnector.create(paymentAPath, paymentAFile)

  readIndex = await slashtagsConnector.readLocal(indexPath)
  t.alike(readIndex, { paymentEndpoints: { testA: paymentAPath } })

  readPaymentA = await slashtagsConnector.readLocal(paymentAPath)
  t.alike(readPaymentA, paymentAFile)

  await slashtagsConnector.create(paymentBPath, paymentBFile)

  readIndex = await slashtagsConnector.readLocal(indexPath)
  t.alike(readIndex, { paymentEndpoints: { testA: paymentAPath, testB: paymentBPath } })

  readPaymentA = await slashtagsConnector.readLocal(paymentAPath)
  t.alike(readPaymentA, paymentAFile)

  const readPaymentB = await slashtagsConnector.readLocal(paymentBPath)
  t.alike(readPaymentB, paymentBFile)

  await slashtagsConnector.delete(paymentAPath)

  readIndex = await slashtagsConnector.readLocal(indexPath)
  t.alike(readIndex, { paymentEndpoints: { testB: paymentBPath } })

  readPaymentA = await slashtagsConnector.readLocal(paymentAPath)
  t.alike(readPaymentA, null)

  t.teardown(async () => await slashtagsConnector.close())
})
