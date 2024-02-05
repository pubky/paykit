const logger = require('slashtags-logger')('Paykit', 'plugin-manager')
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
    logger.info('Initializing plugin manager')
    this.plugins = {}
    if (!config) throw new Error(ERRORS.CONFIG_MISSING)

    this.config = config
  }

  /**
   * Load a plugin with runtime by path to the entry point
   * @param {string} pluginEntryPoint - path to plugins main
   * @param {[any]} pluginConfig - plugin config
   * @returns {Promise<Plugin>} - plugin instance
   * @throws {Error} - if plugin is already loaded
   */
  async loadPlugin (pluginEntryPoint, pluginConfig = null) {
    logger.info('Loading plugin')
    const { module, config } = this.loadByPathOrName(pluginEntryPoint)

    return await this.injectPlugin(module, config || pluginConfig)
  }

  /**
   * Inject plugin into the manager
   * @param {any} module - plugin module object
   * @param {object} pluginConfig - plugin config object
   * @returns {Promise<Plugin>} - plugin instance
   * @throws {Error} - if plugin is already loaded
   * @throws {Error} - if plugin is not valid
   * @throws {Error} - if plugin failed to initialize
   * @throws {Error} - if plugin failed to get manifest
   */
  async injectPlugin (module, pluginConfig) {
    // TODO: inject logger to plugin
    logger.debug('Injecting plugin')
    const plugin = await this.initPlugin(module, pluginConfig)
    const manifest = await this.getManifest(module, plugin)

    const p = { manifest, plugin, active: true }
    this.plugins[manifest.name] = p

    return p
  }

  /**
   * Disable a plugin by calling its "stop" method
   * @param {string} name - name of the plugin
   */
  async stopPlugin (name) {
    logger.info.extend(name)('Stopping plugin')

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
    logger.info.extend(name)('Removing plugin')
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
    logger.info.extend(event)('Dispatching event')
    await Promise.all(
      Object.entries(this.plugins)
        .filter(([_name, plugin]) => (plugin.manifest.events.includes(event) && plugin.active))
        .map(async ([name, plugin]) => {
          try {
            logger.debug.extend(event).extend(name).extend('Dispatching event').extend('Data')(JSON.stringify(data))
            await plugin.plugin[event](data)
            logger.debug.extend(event).extend(name)('Event dispatched')
          } catch (e) {
            ERRORS.PLUGIN.EVENT_DISPATCH(name, e.message)
            logger.error.extend(event)(e.message)
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
      logger.debug.extend(name)('Stopping plugin')
      await this.stopPlugin(name)
    }

    throw error
  }

  /**
   * Initialize plugin
   * @param {any} plugin module object
   * @param {storeage} storage - instance with CRUD interface for receiving payments
   * @returns {Promise<Plugin>} - plugin instance
   */
  async initPlugin (module, storage) {
    try {
      logger.info('Initializing plugin')
      return await module.init(storage)
    } catch (e) {
      throw new Error(ERRORS.PLUGIN.INIT(e.message))
    }
  }

  /**
   * Get plugins manifest
   * @returns {Promise<Object>} - manifest
   */
  async getManifest (module, plugin) {
    let manifestRes
    try {
      logger.info('Retreiving manifest')
      manifestRes = await module.getmanifest()
    } catch (e) {
      throw new Error(ERRORS.PLUGIN.GET_MANIFEST(e.message))
    }

    await utils.validateManifest(manifestRes, plugin)
    const manifest = JSON.parse(JSON.stringify(manifestRes))

    if (this.plugins[manifest.name]) throw new Error(ERRORS.CONFLICT)

    return manifest
  }

  /**
   * Load plugin by path to the entry point or name if path is in config
   * @param {string} pluginEntryPoint - path to plugins main or plugin name if it is already in config
   * @returns {any} - plugin module
   * @throws {Error} - if plugin failed to load
   */
  loadByPathOrName (pluginEntryPoint) {
    logger.info(`Loading plugin ${pluginEntryPoint}`)
    if (typeof this.config.plugins[pluginEntryPoint] === 'object') {
      return {
        module: this.config.plugins[pluginEntryPoint],
        config: this.config[pluginEntryPoint]
      }
    }
    try {
      return {
        module: require(pluginEntryPoint),
        config: this.config[pluginEntryPoint]
      }
    } catch (e) {
      try {
        return {
          module: require(this.config.plugins[pluginEntryPoint]),
          config: this.config[pluginEntryPoint]
        }
      } catch (e) {
        throw new Error(ERRORS.FAILED_TO_LOAD(pluginEntryPoint))
      }
    }
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
