const { test } = require('brittle')

const { TransportConnector, ERRORS, SLASHPAY_PATH } = require('../../src/transport')

const { tmpdir, sleep } = require('../helpers')

const { Relay } = require('@synonymdev/web-relay')

test('TransportConnector.validate', async t => {
  t.exception(() => TransportConnector.validate(), ERRORS.INVALID_JSON)
  t.exception(() => TransportConnector.validate(null), ERRORS.INVALID_JSON)
  t.exception(() => TransportConnector.validate(''), ERRORS.INVALID_JSON)
  t.exception(() => TransportConnector.validate('test'), ERRORS.INVALID_JSON)
  t.exception(() => TransportConnector.validate(1), ERRORS.INVALID_JSON)
  t.exception(() => TransportConnector.validate(true), ERRORS.INVALID_JSON)
  t.exception(() => TransportConnector.validate(false), ERRORS.INVALID_JSON)
  t.exception(() => TransportConnector.validate([]), ERRORS.INVALID_JSON)
  t.exception(() => TransportConnector.validate({}), ERRORS.INVALID_JSON)

  t.execution(() => TransportConnector.validate({ test: 'test' }))
})

test('TransportConnector.getUrl', async t => {
  const transportConnector = new TransportConnector()
  const url = await transportConnector.getUrl()

  t.ok(url.startsWith('slash'))

  t.teardown(async () => await transportConnector.close())
})

test('TransportConnector.create', async t => {
  const transportConnector = new TransportConnector()

  await t.exception(async () => await transportConnector.create(), ERRORS.INVALID_JSON)

  const path = '/public/foo.json'
  const url = await transportConnector.create(path, { test: 'test' })

  // WHY '#' ????
  t.ok(url.startsWith('slash') && url.endsWith('/public/foo.json#'))

  t.teardown(async () => await transportConnector.close())
})

test('TransportConnector.readLocal - default path', async t => {
  const transportConnector = new TransportConnector()

  const path = SLASHPAY_PATH
  const stored = { test: 'test' }
  await transportConnector.create(path, stored)

  const read = await transportConnector.readLocal()
  t.alike(read, stored)

  t.teardown(async () => await transportConnector.close())
})

test('TransportConnector.readLocal - non-default path', async t => {
  const transportConnector = new TransportConnector()

  const path = '/foo.json'

  const stored = { test: 'test' }
  await transportConnector.create(path, stored)

  const read = await transportConnector.readLocal(path)
  t.alike(read, stored)

  t.teardown(async () => await transportConnector.close())
})

test('TransportConnector.readRemote - default path', async t => {
  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const transportConnectorReader = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  const transportConnectorWriter = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  await t.exception(async () => await transportConnectorReader.readRemote(), ERRORS.INVALID_URL)

  const stored = { test: 'test' }
  const source = await transportConnectorWriter.create(SLASHPAY_PATH, stored)

  const read = await transportConnectorReader.readRemote(source)
  t.alike(read, stored)

  t.teardown(async () => {
    await relay.close()
  })
})

test('TransportConnector.readRemote - non-default public path', async t => {
  const relay = new Relay(tmpdir())
  await relay.listen(3000)

  const transportConnectorReader = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })
  const transportConnectorWriter = new TransportConnector({
    storage: tmpdir(),
    relay: 'http://localhost:3000'
  })

  const path = '/public/foo.json'
  const stored = { test: 'test' }
  const urlPath = await transportConnectorWriter.create(path, stored)

  await sleep(100)

  const read = await transportConnectorReader.readRemote(urlPath)
  t.alike(read, stored)

  t.teardown(async () => {
    await relay.close()
  })
})

test('TransportConnector.update', async t => {
  const transportConnector = new TransportConnector()

  const path = '/public/foo.json'
  const stored = { test: 'test' }
  await transportConnector.create(path, stored)

  const read = await transportConnector.readLocal(path)
  t.alike(read, stored)

  const updated = { test: 'updated' }
  await transportConnector.update(path, updated)

  const readAgain = await transportConnector.readLocal(path)
  t.alike(readAgain, updated)

  t.teardown(async () => await transportConnector.close())
})

test('TransportConnector.delete - index', async t => {
  const transportConnector = new TransportConnector()

  const indexPath = SLASHPAY_PATH
  const paymentPath = '/public/test.json'

  await t.exception(async () => await transportConnector.delete(indexPath), ERRORS.INDEX_NOT_FOUND)

  const indexFile = { paymentEndpoints: { test: paymentPath } }
  await transportConnector.create(indexPath, indexFile)

  const paymentFile = { test: 'test' }
  await transportConnector.create(paymentPath, paymentFile)

  const readIndex = await transportConnector.readLocal(indexPath)
  t.alike(readIndex, indexFile)

  const readPayment = await transportConnector.readLocal(paymentPath)
  t.alike(readPayment, paymentFile)

  await transportConnector.delete()

  const readIndexDeleted = await transportConnector.readLocal(indexPath)
  t.alike(readIndexDeleted, null)

  const readPaymentDeleted = await transportConnector.readLocal(paymentPath)
  t.alike(readPaymentDeleted, null)

  t.teardown(async () => await transportConnector.close())
})

test('TransportConnector.delete - payment file', async t => {
  const transportConnector = new TransportConnector()

  let readIndex
  const indexPath = SLASHPAY_PATH

  const paymentAPath = '/public/testA.json'
  const paymentAFile = { testA: 'testA' }
  let readPaymentA

  const paymentBPath = '/public/testB.json'
  const paymentBFile = { testB: 'testB' }

  await t.exception(async () => await transportConnector.delete(indexPath), ERRORS.INDEX_NOT_FOUND)

  await transportConnector.create(paymentAPath, paymentAFile)

  readIndex = await transportConnector.readLocal(indexPath)
  t.alike(readIndex, { paymentEndpoints: { testA: paymentAPath } })

  readPaymentA = await transportConnector.readLocal(paymentAPath)
  t.alike(readPaymentA, paymentAFile)

  await transportConnector.create(paymentBPath, paymentBFile)

  readIndex = await transportConnector.readLocal(indexPath)
  t.alike(readIndex, { paymentEndpoints: { testA: paymentAPath, testB: paymentBPath } })

  readPaymentA = await transportConnector.readLocal(paymentAPath)
  t.alike(readPaymentA, paymentAFile)

  const readPaymentB = await transportConnector.readLocal(paymentBPath)
  t.alike(readPaymentB, paymentBFile)

  await transportConnector.delete(paymentAPath)

  readIndex = await transportConnector.readLocal(indexPath)
  t.alike(readIndex, { paymentEndpoints: { testB: paymentBPath } })

  readPaymentA = await transportConnector.readLocal(paymentAPath)
  t.alike(readPaymentA, null)

  t.teardown(async () => await transportConnector.close())
})
