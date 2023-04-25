const utils = require('./utils')

const { ERRORS } = utils

class PluginManager {
  /**
   * Plugin manager class
   * @class PluginManager
   * @constructor
   * @param {Object} config - config object
   * @property {Object[Plugin]} plugins - loaded plugins
   */
  constructor (config) {
    this.plugins = {}
    this.config = config
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
      try {
        module = require(this.config.plugins[pluginEntryPoint])
      } catch (e) {
        throw new Error(ERRORS.FAILED_TO_LOAD(pluginEntryPoint))
      }
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

    await utils.validateManifest(manifestRes, plugin)
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
