const assert = require('node:assert/strict')
const fs = require('fs')

const ERRORS = {
  PLUGIN_CONFLICT: 'Conflicting plugin names',
  PLUGIN_IS_ACTIVE: 'Can not remove active plugin',
  PLUGIN_NOT_READABLE: 'Plugin entry point must be readable',
  PLUGIN_NAME_MISSING: (msg) => `${msg} plugin name missing`,
  PLUGIN_NAME_NOT_STRING: (msg) => `${msg} plugin name is not a string`,
  PLUGIN_RPC_NOT_ARRAY: (msg) => `${msg} RPC is not an array`,
  PLUGIN_RPC_NOT_STRING: (msg, rpc) => `${msg} RPC method ${rpc} is not a string`,
  PLUGIN_RPC_NOT_UNIQ: (msg) => `${msg} duplicated RPC methods`,
  PLUGIN_EVENTS_NOT_ARRAY: (msg) => `${msg} events is not an array`,
  PLUGIN_EVENT_NOT_STRING: (msg, event) => `${msg} event ${event} is not a string`
}

class PluginManager {
  /**
   * @param {Object} config - configuration object
   * @property {Object[PluginConfig]} config.plugins - array of plugin elements
   */
  constructor (config) {
    this.plugins = {}
    this.config = config

    if (!config.plugins) return

    // XXX: is it even needed or should we just throw on require error?
    // TODO: change to check if directory
    // - is readable
    // - contains package.json
    config.plugins.forEach((pluginEntryPoint) => {
      const stat = fs.statSync(pluginEntryPoint)
      assert(
        parseInt((stat.mode & parseInt('777', 8)).toString(8)[0]) >= 6,
        ERRORS.PLUGIN_NOT_READABLE
      )
    })
  }

  /**
   * Load a plugin with runtime by path to the entry point
   * @param {string} pluginEntryPoint - path to plugins main
   * @returns {Promise<Plugin>} - plugin instance
   * @throws {Error} - if plugin is already loaded
   */
  async loadPlugin (pluginEntryPoint) {
    const active = true
    const module = require(pluginEntryPoint)

    const plugin = await module.init()
    const manifestRes = await module.getmanifest()

    await this.validateManifest(manifestRes)
    const manifest = JSON.parse(JSON.stringify(manifestRes))

    if (this.plugins[manifest.name]) throw new Error(ERRORS.PLUGIN_CONFLICT)

    const p = { manifest, plugin, active }
    this.plugins[manifest.name] = p
    return p
  }

  /**
   * Disable a plugin by calling its "stop" method
   * @param {string} name - name of the plugin
   */
  async stopPlugin (name) {
    if (typeof this.plugins[name].plugin.stop === 'function') {
      await this.plugins[name].plugin.stop()
    }
    this.plugins[name].active = false
  }

  /**
   * Unload a plugin by removing it from the map of plugins
   * @param {string} name - name of the plugin
   * @returns {boolean} - true if plugin was removed, false if plugin is active and can not be removed
   *
   */
  removePlugin (name) {
    if (this.plugins[name].active) return false

    delete this.plugins[name]
    return true
  }

  /**
   * Get a map of all loaded plugins
   * @param {boolean} isActive - if true, return only active plugins
   * @returns {Object[Plugin]} - map of plugins
   */
  getPlugins (isActive) {
    return (typeof isActive === 'undefined')
      ? this.plugins
      : Object.fromEntries(
        Object.entries(this.plugins)
          .filter(([_name, plugin]) => plugin.active === isActive))
  }

  /**
   * Validates manifest
   * @param {PluginManifest} manifest - manifest object
   * @returns {Promise<void>}
   * @throws {Error} - if manifest is invalid
   */
  async validateManifest (manifest) {
    const msg = 'Manifest [validation]:'

    this.validateName(manifest, msg)
    this.validateRPC(manifest, msg)
    this.validateEvents(manifest, msg)
  }

  /**
   * Validates name property of the manifest
   * @param {PluginManifest} manifest - manifest object
   * @param {string} msg - error message prefix
   * @returns {void}
   * @throws {Error} - if name is missing
   */
  validateName (manifest, msg) {
    assert(manifest.name, ERRORS.PLUGIN_NAME_MISSING(msg))
    assert.equal(typeof manifest.name, 'string', ERRORS.PLUGIN_NAME_NOT_STRING(msg))
  }

  /**
   * Validates rpc property of the manifest
   * @param {PluginManifest} manifest - manifest object
   * @param {string} msg - error message prefix
   * @returns {void}
   * @throws {Error} - if rpc is not an array or contains non-string elements or is missing
   */
  validateRPC (manifest, msg) {
    if (!manifest.rpc) {
      return
    }

    assert(Array.isArray(manifest.rpc), ERRORS.PLUGIN_RPC_NOT_ARRAY(msg))
    manifest.rpc.forEach(rpc => assert(
      typeof rpc === 'string',
      ERRORS.PLUGIN_RPC_NOT_STRING(msg, rpc))
    )

    const unique = [...new Set(manifest.rpc.map(rpc => rpc.toLowerCase()))]
    assert.equal(manifest.rpc.length, unique.length, ERRORS.PLUGIN_RPC_NOT_UNIQ(msg))
  }

  /**
   * Validate events property of the manifest
   * @param {PluginManifest} manifest - manifest object
   * @param {string} msg - error message prefix
   * @returns {void}
   * @throws {Error} - if events is not an array or contains non-string elements or is missing
   */
  validateEvents (manifest, msg) {
    if (!manifest.events) {
      return
    }

    assert(Array.isArray(manifest.events), ERRORS.PLUGIN_EVENTS_NOT_ARRAY(msg))
    manifest.events.forEach(event => {
      assert(typeof event === 'string', ERRORS.PLUGIN_EVENT_NOT_STRING(msg, event))
    })
  }

  /**
   * Deactivate all plugins and throw an error
   * @param {Error} error - error to throw
   * @throws {Error} - error
   */
  async gracefulThrow (error) {
    for (const name in this.plugins) {
      await this.stopPlugin(name)
    }

    throw error
  }
}

/**
 * Plugin Configuration Object
 * @typedef PluginConfig
 * @type {Object}
 * @property {string} pluginEntryPoint - path to main
 */

/**
 * Plugin Manifest Object
 * @typedef PluginManifest
 * @type {Object}
 * @property {string} name - plugin name
 *
 */
module.exports = {
  PluginManager,
  ERRORS
}
