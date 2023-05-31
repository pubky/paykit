const { test } = require('brittle')
const createTestnet = require('@hyperswarm/testnet')

const { SlashtagsConnector, ERRORS, SLASHPAY_PATH } = require('../../src/slashtags/index.js')

test('SlashtagsConnector - constructor', async t => {
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnector = new SlashtagsConnector(testnet)
  t.ok(slashtagsConnector.coreData)
  t.absent(slashtagsConnector.ready)

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.init', async t => {
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnector = new SlashtagsConnector(testnet)
  t.ok(slashtagsConnector.coreData)

  await slashtagsConnector.init()
  t.ok(slashtagsConnector.ready)

  t.teardown(async () => await slashtagsConnector.close())
})

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
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnector = new SlashtagsConnector(testnet)

  t.exception(slashtagsConnector.create(), ERRORS.NOT_READY)
  await slashtagsConnector.init()

  t.is(slashtagsConnector.getUrl(), slashtagsConnector.coreData.url)

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.create', async t => {
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnector = new SlashtagsConnector(testnet)

  t.exception(slashtagsConnector.create(), ERRORS.NOT_READY)
  await slashtagsConnector.init()

  t.exception(slashtagsConnector.create(), ERRORS.INVALID_JSON)

  const path = '/foo.json'
  const url = await slashtagsConnector.create(path, { test: 'test' })
  t.is(url, `${slashtagsConnector.coreData.url}${path}`)

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.readLocal - default path', async t => {
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnector = new SlashtagsConnector(testnet)

  t.exception(slashtagsConnector.readLocal(), ERRORS.NOT_READY)
  await slashtagsConnector.init()

  const path = SLASHPAY_PATH
  const stored = { test: 'test' }
  await slashtagsConnector.create(path, stored)

  const read = await slashtagsConnector.readLocal()
  t.alike(read, stored)

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.readLocal - non-default path', async t => {
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnector = new SlashtagsConnector(testnet)

  const path = '/foo.json'

  t.exception(slashtagsConnector.readLocal(path), ERRORS.NOT_READY)
  await slashtagsConnector.init()

  const stored = { test: 'test' }
  await slashtagsConnector.create(path, stored)

  const read = await slashtagsConnector.readLocal(path)
  t.alike(read, stored)

  t.teardown(async () => await slashtagsConnector.close())
})

test('SlashtagsConnector.readRemote - default path', async t => {
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnectorReader = new SlashtagsConnector(testnet)
  t.exception(slashtagsConnectorReader.readRemote(), ERRORS.NOT_READY)
  await slashtagsConnectorReader.init()

  const slashtagsConnectorWriter = new SlashtagsConnector(testnet)
  t.exception(slashtagsConnectorWriter.readRemote(), ERRORS.NOT_READY)
  await slashtagsConnectorWriter.init()

  const stored = { test: 'test' }
  await slashtagsConnectorWriter.create(SLASHPAY_PATH, stored)
  const url = slashtagsConnectorWriter.getUrl()

  const read = await slashtagsConnectorReader.readRemote(url)
  t.alike(read, stored)

  t.teardown(async () => {
    await slashtagsConnectorReader.close()
    await slashtagsConnectorWriter.close()
  })
})

test('SlashtagsConnector.readRemote - non-default public path', async t => {
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnectorReader = new SlashtagsConnector(testnet)
  t.exception(slashtagsConnectorReader.readRemote(), ERRORS.NOT_READY)
  await slashtagsConnectorReader.init()

  const slashtagsConnectorWriter = new SlashtagsConnector(testnet)
  t.exception(slashtagsConnectorWriter.readRemote(), ERRORS.NOT_READY)
  await slashtagsConnectorWriter.init()

  const path = '/public/foo.json'
  const stored = { test: 'test' }
  const urlPath = await slashtagsConnectorWriter.create(path, stored)

  const read = await slashtagsConnectorReader.readRemote(urlPath)
  t.alike(read, stored)

  t.teardown(async () => {
    await slashtagsConnectorReader.close()
    await slashtagsConnectorWriter.close()
  })
})

test('SlashtagsConnector.update', async t => {
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnector = new SlashtagsConnector(testnet)
  t.exception(slashtagsConnector.readLocal(), ERRORS.NOT_READY)
  await slashtagsConnector.init()

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

test('SlashtagsConnector.delete', async t => {
  const testnet = await createTestnet(3, t.teardown)

  const slashtagsConnector = new SlashtagsConnector(testnet)
  t.exception(slashtagsConnector.readLocal(), ERRORS.NOT_READY)
  await slashtagsConnector.init()

  const path = '/public/foo.json'
  const stored = { test: 'test' }
  await slashtagsConnector.create(path, stored)

  const read = await slashtagsConnector.readLocal(path)
  t.alike(read, stored)

  await slashtagsConnector.delete(path)

  const readAgain = await slashtagsConnector.readLocal(path)
  t.alike(readAgain, null)

  t.teardown(async () => await slashtagsConnector.close())
})
