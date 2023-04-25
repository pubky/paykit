const { test } = require('brittle')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const { PluginManager, ERRORS } = require('../../src/plugins/PluginManager.js')
const utils = require('../../src/plugins/utils')

const storage = require('../fixtures/storageInstance.js')

const { pluginConfig } = require('../fixtures/config.js')
test('PluginManager.constructor', t => {
  const pluginManager = new PluginManager()

  t.alike(pluginManager.plugins, {})
})

test('PluginManager.loadPlugin', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()
  const p2trStub = require('../fixtures/p2tr/main.js')
  p2trStub.resetAll()

  const validateManifestSpy = sinon.fake(utils.validateManifest)
  const { PluginManager } = proxyquire('../../src/plugins/PluginManager.js', {
    './utils': {
      validateManifest: sinon.replace(utils, 'validateManifest', validateManifestSpy)
    }
  })
  const pluginManager = new PluginManager()
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
    sinon.restore()
    p2shStub.resetAll()
    p2trStub.resetAll()
  })
})

test('PluginManager.loadPlugin init - error handling', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')

  const pluginManager = new PluginManager()

  sinon.replace(p2shStub, 'init', sinon.fake.throws(new Error('test error')))
  await t.exception(
    async () => await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage),
    ERRORS.PLUGIN.INIT('test error')
  )

  t.teardown(() => {
    sinon.restore()
  })
})

test('PluginManger.loadPlugin getmanifest - error handling', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')

  const pluginManager = new PluginManager()

  sinon.replace(p2shStub, 'getmanifest', sinon.fake.throws(new Error('test error')))
  await t.exception(
    async () => await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage),
    ERRORS.PLUGIN.GET_MANIFEST('test error')
  )

  t.teardown(() => {
    sinon.restore()
  })
})

test('PluginManager.dispatchEvent - error handling', async t => {
  const pluginManager = new PluginManager()

  const p = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)
  sinon.replace(p.plugin, 'onEvent', sinon.fake.throws(new Error('test error')))
  await t.execution(async () => await pluginManager.dispatchEvent('testEvent', {}))

  t.teardown(() => sinon.restore())
})

test('PluginManager plugin stop - error handling', async t => {
  const pluginManager = new PluginManager()

  const p = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)
  sinon.replace(p.plugin, 'stop', sinon.fake.throws(new Error('test error')))
  await t.exception(
    async () => await pluginManager.stopPlugin('testA'),
    ERRORS.PLUGIN.STOP('test error')
  )

  t.teardown(() => {
    sinon.restore()
    p.plugin.resetAll()
  })
})

test('PluginManager.loadPlugin by name', async t => {
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

  t.teardown(() => {
    sinon.restore()
    pluginP2SH.resetAll()
  })
})

test('PluginManager.loadPlugin - duplicated', async t => {
  const pluginManager = new PluginManager()
  const p = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  await t.exception(
    async () => await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage),
    ERRORS.CONFLICT
  )

  t.teardown(() => {
    sinon.restore()
    p.plugin.resetAll()
  })
})

test('PluginManger.loadPluing - nonexisting plugin', async t => {
  const pluginManager = new PluginManager()
  await t.exception(
    async () => await pluginManager.loadPlugin(pluginConfig.plugins.nonexisting, storage),
    ERRORS.FAILED_TO_LOAD(pluginConfig.plugins.nonexisting)
  )

  t.teardown(() => {
    sinon.restore()
  })
})

test('PluginManager - stop plugin', async (t) => {
  const pluginManager = new PluginManager()
  const p = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  await pluginManager.stopPlugin('p2sh')

  t.is(p.active, false)
  t.is(p.plugin.stop.callCount, 1)

  t.teardown(() => {
    sinon.restore()
    p.plugin.resetAll()
  })
})

test('PluginManager.removePlugin', async (t) => {
  const pluginManager = new PluginManager()
  const a = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)

  t.is(pluginManager.removePlugin('p2sh'), false)
  t.is(a.active, true)

  await pluginManager.stopPlugin('p2sh')
  t.is(a.active, false)

  t.is(pluginManager.removePlugin('p2sh'), true)
  t.absent(pluginManager.plugins.p2sh)

  t.teardown(() => {
    sinon.restore()
    a.plugin.resetAll()
  })
})

test('PluginManager.getPlugins', async (t) => {
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
    sinon.restore()
    pluginP2SH.plugin.resetAll()
    pluginP2TR.plugin.resetAll()
  })
})

test('PluginManager.dispatchEvent', async (t) => {
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
    sinon.restore()
    pluginP2SH.plugin.resetAll()
    pluginP2TR.plugin.resetAll()
  })
})

test('PluginManager.getRPCRegistry', async (t) => {
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
    sinon.restore()
    pluginP2SH.plugin.resetAll()
    pluginP2TR.plugin.resetAll()
  })
})

test('PluginManager.gracefulThrow', async (t) => {
  const pluginManager = new PluginManager()
  const a = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, storage)
  const b = await pluginManager.loadPlugin(pluginConfig.plugins.p2tr, storage)

  await t.exception(async () => await pluginManager.gracefulThrow('test error'), 'test error')

  t.is(a.plugin.stop.callCount, 1)
  t.is(b.plugin.stop.callCount, 1)

  t.is(a.active, false)
  t.is(b.active, false)

  t.teardown(() => {
    sinon.restore()
    a.plugin.resetAll()
    b.plugin.resetAll()
  })
})
