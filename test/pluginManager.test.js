const assert = require('node:assert/strict')
const fs = require('fs')
const PluginManager = require('../src/pluginManager.js')

describe('PluginManager', () => {
  let conf
  before(() => {
    conf = require('./fixtures/config.js').pluginConfig
  })

  describe('constructor', () => {
    let config
    beforeEach(() => config = JSON.parse(JSON.stringify(conf)))

    it('instantiates without plugins', () => {
      delete config.plugins
      new PluginManager(config)
    })

    it('throws if plugin does not exist', () => {
      config.plugins.splice(1, 1)
      assert(() => new PluginManager(config), { message: 'Plugin entry point must be executable' })
    })

    it('throws if plugin is not executable', () => {
      config.plugins.pop()
      assert(() => new PluginManager(config), { message: 'Plugin entry point must be executable' })
    })

    describe('instance', () => {
      let instance
      let cfg
      before(() => {
        cfg = JSON.parse(JSON.stringify((conf)))
        cfg.plugins.pop() // non executable
        cfg.plugins.pop() // not existing
        instance = new PluginManager(cfg)
      })

      it('has config', () => assert.deepStrictEqual(instance.config, cfg))
      it('has plugins', () => assert.deepStrictEqual(instance.plugins, {}))
    })
  })
})
// TODO: test cases
//
// loadPlugin
// - plugin has init method
// - plugin has getmanifest method
// parseManifestRes
// gracefulThrow
// - throws if plugin already loaded
// - stores plugin in state as active
// - returns plugin
//
// deactivatePlugin
// - calls stop method if plugin has it
// - sets plugin as inactive
//
// activatePlugin
// - calls start method if plugin has it
// - sets plugin to active
//
// removePlugin
// gracefulThrow if active
// delete from internal state
//
// getPlugins
// - returns all if called with no param
// - returns active or inactive depending on input
//
// parseManifestRes
// gracefulThrow if manifest is invalid json
// validateManifest
// - returns parsed manifest
//
// validateManifest
// validateName -> gracefulThrow
// validateRPC -> gracefulThrow
// validateEvents -> gracefulThrow
//
// validateName
// - throws if name does not exist
//
// validateRPC
// - returns if no rpcs
// throws if RPC is not an array
// throws if some elements are not string
//
// validateEvents
// - returns if no events
// - throws if events is not array
// - throws if some element is not string
// - throws if some element does not exist in config.events
//
// gracefulThrow
// - deactivates all plugins
// - thorws input parameter
