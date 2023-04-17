const { assert } = require('./utils')

const ERRORS = {
  CONFLICT: 'Conflicting plugin names',
  FAILED_TO_LOAD: (path) => `Failed to load plugin at ${path}`,
  NAME: {
    MISSING: (msg) => `${msg} plugin name missing`,
    NOT_STRING: (msg) => `${msg} plugin name is not a string`
  },
  RPC: {
    NOT_ARRAY: (msg) => `${msg} RPC is not an array`,
    NOT_STRING: (msg, rpc) => `${msg} RPC method ${rpc} is not a string`,
    NOT_UNIQ: (msg) => `${msg} duplicated RPC methods`,
    NOT_IMPLEMENTED: (msg, rpc) => `${msg} RPC method ${rpc} is not implemented`,
    MISSING_LISTENER: (msg) => `${msg} RPC listener is not implemented`,
    MISSING_PAY: (msg) => `${msg} must implement "pay" method`
  },
  EVENTS: {
    NOT_ARRAY: (msg) => `${msg} events is not an array`,
    NOT_STRING: (msg, event) => `${msg} event ${event} is not a string`,
    MISSING_LISTENER: (msg) => `${msg} event listener is not implemented`,
    MISSING_WATCH: (msg) => `${msg} must subscribe to "serve" event`
  },
  PLUGIN: {
    INIT: (msg) => `Failed to initialize plugin: ${msg}`,
    GET_MANIFEST: (msg) => `Failed to get manifest: ${msg}`,
    STOP: (msg) => `Failed to stop plugin: ${msg}`,
    EVENT_DISPATCH: (name, msg) => `Failed to dispatch event: ${msg} to plugin ${name}`,
    NOT_FOUND: (name) => `Plugin ${name} not found`
  }
}

class PluginManager {
  /**
   * Plugin manager class
   * @class PluginManager
   * @property {Object[Plugin]} plugins - loaded plugins
   */
  constructor () {
    this.plugins = {}
  }

  /**
   * Load a plugin with runtime by path to the entry point
   * @param {string} pluginEntryPoint - path to plugins main
   * @param {[Storage]} storage - instance with CRUD interface for receiving payments
   * @returns {Promise<Plugin>} - plugin instance
   * @throws {Error} - if plugin is already loaded
   */
  async loadPlugin (pluginEntryPoint, storage) {
    const active = true
    let module
    try {
      // TODO: allow loading by name only by accepting config
      // on constructor which has default path to plugins
      module = require(pluginEntryPoint)
    } catch (e) {
      throw new Error(ERRORS.FAILED_TO_LOAD(pluginEntryPoint))
    }

    let plugin
    try {
      plugin = await module.init(storage)
    } catch (e) {
      throw new Error(ERRORS.PLUGIN.INIT(e.message))
    }

    let manifestRes
    try {
      manifestRes = await module.getmanifest()
    } catch (e) {
      throw new Error(ERRORS.PLUGIN.GET_MANIFEST(e.message))
    }

    await this.validateManifest(manifestRes, plugin)
    const manifest = JSON.parse(JSON.stringify(manifestRes))

    if (this.plugins[manifest.name]) throw new Error(ERRORS.CONFLICT)

    const p = { manifest, plugin, active }
    this.plugins[manifest.name] = p

    return p
  }

  /**
   * Disable a plugin by calling its "stop" method
   * @param {string} name - name of the plugin
   */
  async stopPlugin (name) {
    if (!this.plugins[name]) throw new Error(ERRORS.PLUGIN.NOT_FOUND(name))

    if (typeof this.plugins[name].plugin.stop === 'function') {
      try {
        await this.plugins[name].plugin.stop()
      } catch (e) {
        throw new Error(ERRORS.PLUGIN.STOP(e.message))
      }
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
    if (!this.plugins[name]) throw new Error(ERRORS.PLUGIN_NOT_FOUND(name))

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
   * Dispatch an event to all active plugins
   * @param {string} event - event name
   * @param {Object} data - event data
   * @returns {Promise<void>}
   */
  async dispatchEvent (event, data) {
    await Promise.all(
      Object.entries(this.plugins)
        .filter(([_name, plugin]) => (plugin.manifest.events.includes(event) && plugin.active))
        .map(async ([name, plugin]) => {
          try {
            await plugin.plugin.onEvent(event, data)
          } catch (e) {
            ERRORS.PLUGIN.EVENT_DISPATCH(name, e.message)
            // TODO: log error
          }
        })
    )
  }

  /**
   * Get map with method path as a keys and corresponding plugin methods as values
   * @returns {Object[any]} - map of methods
   */
  getRPCRegistry () {
    return Object.fromEntries(
      Object.entries(this.plugins)
        .map(([name, plugin]) => plugin.manifest.rpc.map((rpc) => [`${name}/${rpc}`, plugin.plugin[rpc]])).flat()
    )
  }

  /**
   * Validates manifest
   * @param {PluginManifest} manifest - manifest object
   * @param {Plugin} plugin - plugin instance
   * @returns {Promise<void>}
   * @throws {Error} - if manifest is invalid
   */
  async validateManifest (manifest, plugin) {
    const msg = 'Manifest [validation]:'

    this.validateName(manifest, msg)
    this.validateRPC(manifest, plugin, msg)
    this.validateEvents(manifest, plugin, msg)
  }

  /**
   * Validates name property of the manifest
   * @param {PluginManifest} manifest - manifest object
   * @param {string} msg - error message prefix
   * @returns {void}
   * @throws {Error} - if name is missing
   */
  validateName (manifest, msg) {
    assert(manifest.name, ERRORS.NAME.MISSING(msg))
    assert(typeof manifest.name === 'string', ERRORS.NAME.NOT_STRING(msg))
  }

  /**
   * Validates rpc property of the manifest
   * @param {PluginManifest} manifest - manifest object
   * @param {Plugin} plugin - plugin instance
   * @param {string} msg - error message prefix
   *
   * @returns {void}
   * @throws {Error} - if rpc is not an array or contains non-string elements or is missing
   */
  validateRPC (manifest, plugin, msg) {
    if (!manifest.rpc) {
      return
    }

    assert(Array.isArray(manifest.rpc), ERRORS.RPC.NOT_ARRAY(msg))

    manifest.rpc.forEach(rpc => {
      assert(typeof rpc === 'string', ERRORS.RPC.NOT_STRING(msg, rpc))
      assert(typeof plugin[rpc] === 'function', ERRORS.RPC.NOT_IMPLEMENTED(msg, rpc))
    })

    const unique = [...new Set(manifest.rpc.map(rpc => rpc.toLowerCase()))]
    assert(manifest.rpc.length === unique.length, ERRORS.RPC.NOT_UNIQ(msg))

    if (manifest.type === 'payment') {
      assert(manifest.rpc.includes('pay'), ERRORS.RPC.MISSING_PAY(msg))
    }
  }

  /**
   * Validate events property of the manifest
   * @param {PluginManifest} manifest - manifest object
   * @param {Plugin} plugin - plugin instance
   * @param {string} msg - error message prefix
   * @returns {void}
   * @throws {Error} - if events is not an array or contains non-string elements or is missing
   */
  validateEvents (manifest, plugin, msg) {
    if (!manifest.events) {
      return
    }

    assert(typeof plugin.onEvent === 'function', ERRORS.EVENTS.MISSING_LISTENER(msg))
    assert(Array.isArray(manifest.events), ERRORS.EVENTS.NOT_ARRAY(msg))
    manifest.events.forEach(event => {
      assert(typeof event === 'string', ERRORS.EVENTS.NOT_STRING(msg, event))
    })

    assert(manifest.events.includes('watch'), ERRORS.EVENTS.MISSING_WATCH(msg))
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

/**
 * Storage Object
 * @typedef Storage
 * @type {Object}
 * @property {function} create - store value in storage
 * @property {function} read - get value from storage
 * @property {update} update - update value in storage
 * @property {delete} delete - delete value from storage
 */

module.exports = {
  PluginManager,
  ERRORS
}
