const { test } = require('brittle')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const { PluginManager, ERRORS } = require('../../src/plugins/PluginManager.js')
const utils = require('../../src/plugins/utils')

const { pluginConfig } = require('../fixtures/config.js')

test('PluginManager.constructor', t => {
  const pluginManager = new PluginManager(pluginConfig)

  t.alike(pluginManager.plugins, {})

  t.exception(() => new PluginManager(), ERRORS.CONFIG_MISSING)
})

test('PluginManager.injectPlugin', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')
  p2shStub.resetAll()

  const validateManifestSpy = sinon.fake(utils.validateManifest)
  const { PluginManager } = proxyquire('../../src/plugins/PluginManager.js', {
    './utils': {
      validateManifest: sinon.replace(utils, 'validateManifest', validateManifestSpy)
    }
  })
  const pluginManager = new PluginManager(pluginConfig)
  const {
    active: activeA,
    manifest: manifestA,
    plugin: pluginP2SH
  } = await pluginManager.injectPlugin(p2shStub, pluginConfig.p2sh)

  t.alike(pluginManager.plugins.p2sh, {
    manifest: manifestA,
    plugin: pluginP2SH,
    active: activeA
  })

  t.is(p2shStub.init.callCount, 1)
  t.alike(p2shStub.init.getCall(0).args, [pluginConfig.p2sh])

  t.is(p2shStub.getmanifest.callCount, 1)
  t.is(validateManifestSpy.callCount, 1)

  t.teardown(() => sinon.restore())
})

test('PluginManager.loadPlugin - by name with default config', async t => {
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
  const pluginManager = new PluginManager(pluginConfig)
  const {
    active: activeA,
    manifest: manifestA,
    plugin: pluginP2SH
  } = await pluginManager.loadPlugin('p2sh')

  t.alike(pluginManager.plugins.p2sh, {
    manifest: manifestA,
    plugin: pluginP2SH,
    active: activeA
  })

  t.is(p2shStub.init.callCount, 1)
  t.alike(p2shStub.init.getCall(0).args, [pluginConfig.p2sh])

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
  } = await pluginManager.loadPlugin('p2tr')

  t.alike(pluginManager.plugins.p2tr, {
    manifest: manifestB,
    plugin: pluginP2TR,
    active: activeB
  })

  t.is(p2shStub.init.callCount, 1)
  t.is(p2shStub.getmanifest.callCount, 1)
  t.is(p2trStub.init.callCount, 1)
  t.alike(p2trStub.init.getCall(0).args, [pluginConfig.p2tr])
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

test('PluginManager.loadPlugin - by path with explicit config', async t => {
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
  const pluginManager = new PluginManager(pluginConfig)
  const {
    active: activeA,
    manifest: manifestA,
    plugin: pluginP2SH
  } = await pluginManager.loadPlugin(pluginConfig.plugins.p2sh, pluginConfig.p2sh)

  t.alike(pluginManager.plugins.p2sh, {
    manifest: manifestA,
    plugin: pluginP2SH,
    active: activeA
  })

  t.is(p2shStub.init.callCount, 1)
  t.alike(p2shStub.init.getCall(0).args, [pluginConfig.p2sh])

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
  } = await pluginManager.loadPlugin(pluginConfig.plugins.p2tr, pluginConfig.p2tr)

  t.alike(pluginManager.plugins.p2tr, {
    manifest: manifestB,
    plugin: pluginP2TR,
    active: activeB
  })

  t.is(p2shStub.init.callCount, 1)
  t.is(p2shStub.getmanifest.callCount, 1)
  t.is(p2trStub.init.callCount, 1)
  t.alike(p2trStub.init.getCall(0).args, [pluginConfig.p2tr])
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

test('PluginManager.loadPlugin - dependency injection', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')

  const pC = {
    db: {},
    plugins: { p2sh: p2shStub },
    p2sh: { foo: 'foo' }
  }

  const pluginManager = new PluginManager(pC)
  const p = await pluginManager.loadPlugin('p2sh')

  t.alike(pluginManager.plugins.p2sh, p)

  t.is(p2shStub.init.callCount, 1)
  t.alike(p2shStub.init.getCall(0).args, [{ foo: 'foo' }])

  t.is(p2shStub.getmanifest.callCount, 1)
})

test('PluginManager.loadPlugin init - error handling', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')

  const pluginManager = new PluginManager(pluginConfig)

  sinon.replace(p2shStub, 'init', sinon.fake.throws(new Error('test error')))
  await t.exception(
    async () => await pluginManager.loadPlugin('p2sh'),
    ERRORS.PLUGIN.INIT('test error')
  )

  t.teardown(() => {
    p2shStub.resetAll()
    sinon.restore()
  })
})

test('PluginManger.loadPlugin getmanifest - error handling', async t => {
  const p2shStub = require('../fixtures/p2sh/main.js')

  const pluginManager = new PluginManager(pluginConfig)

  sinon.replace(p2shStub, 'getmanifest', sinon.fake.throws(new Error('test error')))
  await t.exception(
    async () => await pluginManager.loadPlugin('p2sh'),
    ERRORS.PLUGIN.GET_MANIFEST('test error')
  )

  t.teardown(() => {
    p2shStub.resetAll()
    sinon.restore()
  })
})

test('PluginManager.dispatchEvent - error handling', async t => {
  const pluginManager = new PluginManager(pluginConfig)

  const { plugin } = await pluginManager.loadPlugin('p2sh')

  sinon.replace(plugin, 'receivePayment', sinon.fake.throws(new Error('test error')))
  await t.execution(async () => await pluginManager.dispatchEvent('receivePayment', {}))

  t.teardown(() => sinon.restore())
})

test('PluginManager plugin stop - error handling', async t => {
  const pluginManager = new PluginManager(pluginConfig)

  const { plugin } = await pluginManager.loadPlugin('p2sh')
  sinon.replace(plugin, 'stop', sinon.fake.throws(new Error('test error')))
  await t.exception(
    async () => await pluginManager.stopPlugin('testA'),
    ERRORS.PLUGIN.STOP('test error')
  )

  t.teardown(() => {
    sinon.restore()
    plugin.resetAll()
  })
})

test('PluginManager.loadPlugin by name', async t => {
  const pluginManager = new PluginManager(pluginConfig)
  const {
    plugin: pluginP2SH,
    manifest: manifestA
  } = await pluginManager.loadPlugin('p2sh')

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
  const pluginManager = new PluginManager(pluginConfig)
  const { plugin } = await pluginManager.loadPlugin('p2sh')

  await t.exception(
    async () => await pluginManager.loadPlugin('p2sh'),
    ERRORS.CONFLICT
  )

  t.teardown(() => {
    sinon.restore()
    plugin.resetAll()
  })
})

test('PluginManger.loadPluing - nonexisting plugin', async t => {
  const pluginManager = new PluginManager(pluginConfig)
  await t.exception(
    async () => await pluginManager.loadPlugin(pluginConfig.plugins.nonexisting, { random: 'data' }),
    ERRORS.FAILED_TO_LOAD(pluginConfig.plugins.nonexisting)
  )

  t.teardown(() => {
    sinon.restore()
  })
})

test('PluginManager - stop plugin', async (t) => {
  const pluginManager = new PluginManager(pluginConfig)
  const p = await pluginManager.loadPlugin('p2sh')

  await pluginManager.stopPlugin('p2sh')

  t.is(p.active, false)
  t.is(p.plugin.stop.callCount, 1)

  t.teardown(() => {
    sinon.restore()
    p.plugin.resetAll()
  })
})

test('PluginManager.removePlugin', async (t) => {
  const pluginManager = new PluginManager(pluginConfig)
  const a = await pluginManager.loadPlugin('p2sh')

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
  const pluginManager = new PluginManager(pluginConfig)
  t.alike(pluginManager.getPlugins(), {})

  const pluginP2SH = await pluginManager.loadPlugin('p2sh')
  const pluginP2TR = await pluginManager.loadPlugin('p2tr')

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

test('PluginManager.dispatchEvent - calls listed methods directly', async (t) => {
  const pluginManager = new PluginManager(pluginConfig)
  const pluginP2SH = await pluginManager.loadPlugin('p2sh')
  const pluginP2TR = await pluginManager.loadPlugin('p2tr')

  await pluginManager.dispatchEvent('event1', { data: 'both' })

  t.is(pluginP2SH.plugin.event1.callCount, 1)
  t.is(pluginP2TR.plugin.event1.callCount, 1)
  t.alike(pluginP2TR.plugin.event1.getCall(0).args, [{ data: 'both' }])

  await pluginManager.stopPlugin('p2sh')
  t.is(pluginP2SH.active, false)
  // only p2sh is not subscribed to event2
  await pluginManager.dispatchEvent('event2', { data: 'nobody' })

  t.is(pluginP2SH.plugin.event2.callCount, 0)
  t.is(pluginP2TR.plugin.event2.callCount, 0)

  await pluginManager.dispatchEvent('event1', { data: 'onlyB' })

  t.is(pluginP2SH.plugin.event1.callCount, 1)
  t.is(pluginP2TR.plugin.event1.callCount, 2)
  t.alike(pluginP2TR.plugin.event1.getCall(1).args, [{ data: 'onlyB' }])

  t.teardown(() => {
    sinon.restore()
    pluginP2SH.plugin.resetAll()
    pluginP2TR.plugin.resetAll()
  })
})

test('PluginManager.getRPCRegistry', async (t) => {
  const pluginManager = new PluginManager(pluginConfig)
  const pluginP2SH = await pluginManager.loadPlugin('p2sh', pluginConfig.p2sh)
  const pluginP2TR = await pluginManager.loadPlugin('p2tr', pluginConfig.p2tr)

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
  const pluginManager = new PluginManager(pluginConfig)
  const a = await pluginManager.loadPlugin('p2sh')
  const b = await pluginManager.loadPlugin('p2tr')

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
