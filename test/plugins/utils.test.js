const { test } = require('brittle')
const sinon = require('sinon')

const utils = require('../../src/plugins/utils')
const { ERRORS } = utils

const pluginP2SH = require('../fixtures/p2sh/main.js')

test('validateManifest', async (t) => {
  const plugin = pluginP2SH.init()

  const validateName = sinon.replace(utils, 'validateName', sinon.fake(utils.validateName))
  const validateRPC = sinon.replace(utils, 'validateRPC', sinon.fake(utils.validateRPC))
  const validateEvents = sinon.replace(utils, 'validateEvents', sinon.fake(utils.validateEvents))

  t.execution(utils.validateManifest({
    name: 'p2sh',
    rpc: ['stop'],
    events: ['watch', 'event1', 'event2']
  }, plugin))

  t.is(validateName.callCount, 1)
  t.is(validateRPC.callCount, 1)
  t.is(validateEvents.callCount, 1)

  t.teardown(() => { sinon.restore() })
})

test('validateName', (t) => {
  t.exception(
    () => utils.validateName({}, 'test prefix'),
    ERRORS.NAME.MISSING('test prefix')
  )

  t.exception(
    () => utils.validateName({ name: 1 }, 'test prefix'),
    ERRORS.NAME.NOT_STRING('test prefix')
  )

  t.teardown(() => {
    sinon.restore()
    pluginP2SH.resetAll()
  })
})

test('validateRPC', async (t) => {
  const plugin = pluginP2SH.init()
  const manifest = pluginP2SH.getmanifest()

  t.execution(utils.validateRPC({}, plugin, 'test prefix'))

  t.exception(
    () => utils.validateRPC({ rpc: 1 }, plugin, 'test prefix'),
    ERRORS.RPC.NOT_ARRAY('test prefix')
  )

  t.exception(
    () => utils.validateRPC({ rpc: ['stop', 'stOp'] }, plugin, 'test prefix'),
    ERRORS.RPC.NOT_UNIQ('test prefix')
  )

  t.exception(
    () => utils.validateRPC({ rpc: ['stop', 1] }, plugin, 'test prefix'),
    ERRORS.RPC.NOT_STRING('test prefix', 1)
  )

  t.exception(
    () => utils.validateRPC({ rpc: ['stop', 'start'] }, plugin, 'test prefix'),
    ERRORS.RPC.NOT_IMPLEMENTED('test prefix', 'start')
  )

  t.exception(
    () => utils.validateRPC(
      { type: 'payment', rpc: ['stop', 'start'] },
      plugin,
      'test prefix'
    ),
    ERRORS.RPC.MISSING_PAY('test prefix')
  )

  t.execution(utils.validateRPC(manifest, plugin, 'test prefix'))

  t.teardown(() => {
    sinon.restore()
    pluginP2SH.resetAll()
  })
})

test('validateEvents', async (t) => {
  const plugin = pluginP2SH.init()

  t.execution(utils.validateEvents({}, plugin, 'test prefix'))

  t.exception(
    () => utils.validateEvents({ events: 1 }, plugin, 'test prefix'),
    ERRORS.EVENTS.NOT_ARRAY('test prefix')
  )

  t.exception(
    () => utils.validateEvents({ events: ['test', 1] }, plugin, 'test prefix'),
    ERRORS.EVENTS.NOT_STRING('test prefix', 1)
  )

  t.exception(
    () => utils.validateEvents({ events: ['test1', 'test2'] }, plugin, 'test prefix'),
    ERRORS.EVENTS.MISSING_WATCH('test prefix')
  )

  t.execution(utils.validateEvents({ events: ['watch', 'test'] }, plugin, 'test prefix'))

  t.teardown(() => {
    sinon.restore()
    pluginP2SH.resetAll()
  })
})
