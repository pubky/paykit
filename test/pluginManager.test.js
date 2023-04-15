const { test } = require('brittle')
const sinon = require('sinon')

const { PluginManager, ERRORS } = require('../src/pluginManager.js')

const storage = require('./fixtures/storageInstance.js')

const { pluginConfig } = require('./fixtures/config.js')
const p2shStub = require('./fixtures/p2sh/main.js')
const p2trStub = require('./fixtures/p2tr/main.js')

test('constructor', t => {
  const pluginManager = new PluginManager()

  t.alike(pluginManager.plugins, {})
})

test('load plugins', async t => {
  const pluginManager = new PluginManager()
  const validateManifestSpy = sinon.spy(pluginManager, 'validateManifest')
  const {
    active: activeA,
    manifest: manifestA,
    plugin: pluginP2SH
  } = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  t.alike(pluginManager.plugins.p2sh, {
    manifest: manifestA,
    plugin: pluginP2SH,
    active: activeA
  })

  t.is(p2shStub.init.callCount, 1)
  t.alike(p2shStub.init.getCall(0).args, [storage])

  t.is(p2shStub.getmanifest.callCount, 1)
  t.is(p2trStub.init.callCount, 0)
  t.is(p2trStub.getmanifest.callCount, 0)
  t.is(validateManifestSpy.callCount, 1)

  t.is(typeof pluginP2SH.stop, 'function')
  t.ok(activeA)

  const {
    active: activeB,
    manifest: manifestB,
    plugin: pluginP2TR
  } = await pluginManager.loadPlugin(pluginConfig.plugins.p2tr, storage)

  t.alike(pluginManager.plugins.p2tr, {
    manifest: manifestB,
    plugin: pluginP2TR,
    active: activeB
  })

  t.is(p2shStub.init.callCount, 1)
  t.is(p2shStub.getmanifest.callCount, 1)
  t.is(p2trStub.init.callCount, 1)
  t.alike(p2trStub.init.getCall(0).args, [storage])
  t.is(p2trStub.getmanifest.callCount, 1)
  t.is(validateManifestSpy.callCount, 2)

  t.is(typeof pluginP2TR.stop, 'function')
  t.ok(activeB)

  t.teardown(() => {
    p2shStub.init.resetHistory()
    p2shStub.getmanifest.resetHistory()

    p2trStub.init.resetHistory()
    p2trStub.getmanifest.resetHistory()

    validateManifestSpy.restore()
  })
})

test('plugin load init - error handling', async t => {
  const pluginManager = new PluginManager()

  sinon.replace(p2shStub, 'init', sinon.fake.throws(new Error('test error')))
  await t.exception(
    async () => await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage),
    ERRORS.PLUGIN.INIT('test error')
  )

  t.teardown(() => sinon.restore())
})

test('plugin load getmanifest - error handling', async t => {
  const pluginManager = new PluginManager()

  sinon.replace(p2shStub, 'getmanifest', sinon.fake.throws(new Error('test error')))
  await t.exception(
    async () => await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage),
    ERRORS.PLUGIN.GET_MANIFEST('test error')
  )

  t.teardown(() => sinon.restore())
})

test('plugin dispatch - error handling', async t => {
  const pluginManager = new PluginManager()

  const p = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)
  sinon.replace(p.plugin, 'onEvent', sinon.fake.throws(new Error('test error')))
  await t.execution(async () => await pluginManager.dispatchEvent('testEvent', {}))

  t.teardown(() => sinon.restore())
})

test('plugin stop - error handling', async t => {
  const pluginManager = new PluginManager()

  const p = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)
  sinon.replace(p.plugin, 'stop', sinon.fake.throws(new Error('test error')))
  await t.exception(
    async () => await pluginManager.stopPlugin('testA'),
    ERRORS.PLUGIN.STOP('test error')
  )

  t.teardown(() => sinon.restore())
})

test('load plugin by name', async t => {
  const pluginManager = new PluginManager(pluginConfig)
  const {
    plugin: pluginP2SH,
    manifest: manifestA
  } = await pluginManager.loadPlugin('p2sh', storage)

  t.alike(pluginManager.plugins.p2sh, {
    manifest: manifestA,
    plugin: pluginP2SH,
    active: true
  })
})

test('load duplicate plugin', async t => {
  const pluginManager = new PluginManager()
  await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  await t.exception(
    async () => await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage),
    ERRORS.CONFLICT
  )

  t.teardown(() => {
    p2shStub.init.resetHistory()
    p2shStub.getmanifest.resetHistory()
  })
})

test('load nonexisting plugin', async t => {
  const pluginManager = new PluginManager()
  await t.exception(
    async () => await pluginManager.loadPlugin(pluginConfig.plugins.nonexisting, storage),
    ERRORS.FAILED_TO_LOAD(pluginConfig.plugins.nonexisting)
  )
})

test('stop plugin', async (t) => {
  const pluginManager = new PluginManager()
  const p = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  await pluginManager.stopPlugin('p2sh')

  t.is(p.active, false)
  t.is(p.plugin.stop.callCount, 1)

  t.teardown(() => {
    p2shStub.init.resetHistory()
    p2shStub.getmanifest.resetHistory()

    p.plugin.stop.resetHistory()
  })
})

test('removePlugin', async (t) => {
  const pluginManager = new PluginManager()
  const a = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  t.is(pluginManager.removePlugin('p2sh'), false)
  t.is(a.active, true)

  await pluginManager.stopPlugin('p2sh')
  t.is(a.active, false)

  t.is(pluginManager.removePlugin('p2sh'), true)
  t.absent(pluginManager.plugins.p2sh)

  t.teardown(() => {
    p2shStub.init.resetHistory()
    p2shStub.getmanifest.resetHistory()
  })
})

test('getPlugins', async (t) => {
  const pluginManager = new PluginManager()
  t.alike(pluginManager.getPlugins(), {})

  const pluginP2SH = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)
  const pluginP2TR = await pluginManager.loadPlugin(pluginConfig.plugins.p2tr, storage)

  t.alike(pluginManager.getPlugins(), { p2sh: pluginP2SH, p2tr: pluginP2TR })
  t.alike(pluginManager.getPlugins(false), {})

  await pluginManager.stopPlugin('p2sh')
  t.is(pluginP2SH.active, false)

  t.alike(pluginManager.getPlugins(true), { p2tr: pluginP2TR })
  t.alike(pluginManager.getPlugins(false), { p2sh: pluginP2SH })

  t.teardown(() => {
    p2shStub.init.resetHistory()
    p2shStub.getmanifest.resetHistory()

    p2trStub.init.resetHistory()
    p2trStub.getmanifest.resetHistory()
  })
})

test('dispatchEvent', async (t) => {
  const pluginManager = new PluginManager()
  const pluginP2SH = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)
  const pluginP2TR = await pluginManager.loadPlugin(pluginConfig.plugins.p2tr, storage)

  await pluginManager.dispatchEvent('event1', { data: 'both' })

  t.is(pluginP2SH.plugin.onEvent.callCount, 1)
  t.is(pluginP2TR.plugin.onEvent.callCount, 1)
  t.alike(pluginP2TR.plugin.onEvent.getCall(0).args, ['event1', { data: 'both' }])

  await pluginManager.stopPlugin('p2sh')
  t.is(pluginP2SH.active, false)
  // b is not subscribed to event2
  await pluginManager.dispatchEvent('event2', { data: 'nobody' })

  t.is(pluginP2SH.plugin.onEvent.callCount, 1)
  t.is(pluginP2TR.plugin.onEvent.callCount, 1)

  await pluginManager.dispatchEvent('event1', { data: 'onlyB' })

  t.is(pluginP2SH.plugin.onEvent.callCount, 1)
  t.is(pluginP2TR.plugin.onEvent.callCount, 2)
  t.alike(pluginP2TR.plugin.onEvent.getCall(1).args, ['event1', { data: 'onlyB' }])

  t.teardown(() => {
    p2shStub.init.resetHistory()
    p2shStub.getmanifest.resetHistory()

    p2trStub.init.resetHistory()
    p2trStub.getmanifest.resetHistory()

    pluginP2SH.plugin.onEvent.resetHistory()
    pluginP2TR.plugin.onEvent.resetHistory()
  })
})

test('getRPCRegistry', async (t) => {
  const pluginManager = new PluginManager()
  const pluginP2SH = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)
  const pluginP2TR = await pluginManager.loadPlugin(pluginConfig.plugins.p2tr, storage)

  t.alike(pluginManager.getRPCRegistry(), {
    'p2sh/stop': pluginP2SH.plugin.stop,
    'p2sh/pay': pluginP2SH.plugin.pay,
    'p2sh/updatePayment': pluginP2SH.plugin.updatePayment,

    'p2tr/stop': pluginP2TR.plugin.stop,
    'p2tr/start': pluginP2TR.plugin.start,
    'p2tr/pay': pluginP2TR.plugin.pay
  })

  t.teardown(() => {
    p2shStub.init.resetHistory()
    p2shStub.getmanifest.resetHistory()

    p2trStub.init.resetHistory()
    p2trStub.getmanifest.resetHistory()

    pluginP2SH.plugin.onEvent.resetHistory()
    pluginP2TR.plugin.onEvent.resetHistory()
  })
})

test('validateManifest', async (t) => {
  const pluginManager = new PluginManager()
  const pluginP2SH = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  const validateNameSpy = sinon.spy(pluginManager, 'validateName')
  const validateRPCSpy = sinon.spy(pluginManager, 'validateRPC')
  const validateEventsSpy = sinon.spy(pluginManager, 'validateEvents')

  t.execution(pluginManager.validateManifest({
    name: 'p2sh',
    rpc: ['stop'],
    events: ['watch', 'event1', 'event2']
  }, pluginP2SH.plugin))

  t.is(validateNameSpy.callCount, 1)
  t.is(validateRPCSpy.callCount, 1)
  t.is(validateEventsSpy.callCount, 1)

  t.teardown(() => {
    validateNameSpy.restore()
    validateRPCSpy.restore()
    validateEventsSpy.restore()
  })
})

test('validateName', (t) => {
  const pluginManager = new PluginManager()
  t.exception(
    () => pluginManager.validateName({}, 'test prefix'),
    ERRORS.NAME.MISSING('test prefix')
  )

  t.exception(
    () => pluginManager.validateName({ name: 1 }, 'test prefix'),
    ERRORS.NAME.NOT_STRING('test prefix')
  )
})

test('validateRPC', async (t) => {
  const pluginManager = new PluginManager()
  const pluginP2SH = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  t.execution(pluginManager.validateRPC({}, pluginP2SH.plugin, 'test prefix'))

  t.exception(
    () => pluginManager.validateRPC({ rpc: 1 }, pluginP2SH.pluginP2SH, 'test prefix'),
    ERRORS.RPC.NOT_ARRAY('test prefix')
  )

  t.exception(
    () => pluginManager.validateRPC({ rpc: ['stop', 'stOp'] }, pluginP2SH.plugin, 'test prefix'),
    ERRORS.RPC.NOT_UNIQ('test prefix')
  )

  t.exception(
    () => pluginManager.validateRPC({ rpc: ['stop', 1] }, pluginP2SH.plugin, 'test prefix'),
    ERRORS.RPC.NOT_STRING('test prefix', 1)
  )

  t.exception(
    () => pluginManager.validateRPC({ rpc: ['stop', 'start'] }, pluginP2SH.plugin, 'test prefix'),
    ERRORS.RPC.NOT_IMPLEMENTED('test prefix', 'start')
  )

  t.exception(
    () => pluginManager.validateRPC(
      { type: 'payment', rpc: ['stop', 'start'] },
      pluginP2SH.plugin,
      'test prefix'
    ),
    ERRORS.RPC.MISSING_PAY('test prefix')
  )

  t.execution(pluginManager.validateRPC(pluginP2SH.manifest, pluginP2SH.plugin, 'test prefix'))
})

test('validateEvents', async (t) => {
  const pluginManager = new PluginManager()
  const pluginP2SH = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  t.execution(pluginManager.validateEvents({}, pluginP2SH.plugin, 'test prefix'))

  t.exception(
    () => pluginManager.validateEvents({ events: 1 }, pluginP2SH.plugin, 'test prefix'),
    ERRORS.EVENTS.NOT_ARRAY('test prefix')
  )

  t.exception(
    () => pluginManager.validateEvents({ events: ['test', 1] }, pluginP2SH.plugin, 'test prefix'),
    ERRORS.EVENTS.NOT_STRING('test prefix', 1)
  )

  t.exception(
    () => pluginManager.validateEvents({ events: ['test1', 'test2'] }, pluginP2SH.plugin, 'test prefix'),
    ERRORS.EVENTS.MISSING_WATCH('test prefix')
  )

  t.execution(pluginManager.validateEvents({ events: ['watch', 'test'] }, pluginP2SH.plugin, 'test prefix'))
})

test('gracefulThrow', async (t) => {
  const pluginManager = new PluginManager()
  const a = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)
  const b = await pluginManager.loadPlugin(pluginConfig.plugins.p2tr, storage)

  await t.exception(async () => await pluginManager.gracefulThrow('test error'), 'test error')

  t.is(a.plugin.stop.callCount, 1)
  t.is(b.plugin.stop.callCount, 1)

  t.is(a.active, false)
  t.is(b.active, false)

  t.teardown(() => {
    p2shStub.init.resetHistory()
    p2shStub.getmanifest.resetHistory()

    p2trStub.init.resetHistory()
    p2trStub.getmanifest.resetHistory()

    a.plugin.stop.resetHistory()
    b.plugin.stop.resetHistory()
  })
})
