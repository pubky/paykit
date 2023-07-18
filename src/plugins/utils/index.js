const utils = require('../../utils')

/**
 * @typedef {Object} Error
 * @property {string} CONFLICT - conflicting plugin names
 * @property {string} FAILED_TO_LOAD - failed to load plugin
 * @property {string} INVALID_CONFIG_PLUGIN - plugin name is missconfigured
 * @property {Object} NAME - name errors
 * @property {string} NAME.MISSING - name is missing
 * @property {string} NAME.NOT_STRING - name is not a string
 * @property {Object} RPC - rpc errors
 * @property {string} RPC.NOT_STRING - rpc method is not a string
 * @property {string} RPC.NOT_UNIQ - rpc methods are not unique
 * @property {string} RPC.NOT_IMPLEMENTED - rpc method is not implemented
 * @property {string} RPC.MISSING_LISTENER - rpc listener is not implemented
 * @property {string} RPC.MISSING_PAY - rpc must implement "pay" method
 * @property {Object} EVENTS - events errors
 * @property {string} EVENTS.NOT_ARRAY - events is not an array
 * @property {string} EVENTS.NOT_STRING - event is not a string
 * @property {string} EVENTS.MISSING_LISTENER - event listener is not implemented
 * @property {string} EVENTS.MISSING_WATCH - event must subscribe to "receivePayment" event
 * @property {Object} PLUGIN - plugin errors
 * @property {string} PLUGIN.INIT - failed to initialize plugin
 * @property {string} PLUGIN.GET_MANIFEST - failed to get manifest
 * @property {string} PLUGIN.STOP - failed to stop plugin
 * @property {string} PLUGIN.EVENT_DISPATCH - failed to dispatch event
 * @property {string} PLUGIN.NOT_FOUND - plugin not found
 */
const ERRORS = {
  CONFLICT: 'Conflicting plugin names',
  FAILED_TO_LOAD: (path) => `Failed to load plugin at ${path}`,
  INVALID_CONFIG_PLUGIN: 'Plugin name is missconfigured',
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
    MISSING_WATCH: (msg) => `${msg} must subscribe to "receivePayment" event`
  },
  PLUGIN: {
    INIT: (msg) => `Failed to initialize plugin: ${msg}`,
    GET_MANIFEST: (msg) => `Failed to get manifest: ${msg}`,
    STOP: (msg) => `Failed to stop plugin: ${msg}`,
    EVENT_DISPATCH: (name, msg) => `Failed to dispatch event: ${msg} to plugin ${name}`,
    NOT_FOUND: (name) => `Plugin ${name} not found`
  }
}

/**
 * Validates manifest
 * @param {PluginManifest} manifest - manifest object
 * @param {Plugin} plugin - plugin instance
 * @returns {Promise<void>}
 * @throws {Error} - if manifest is invalid
 */
function validateManifest (manifest, plugin) {
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
function validateName (manifest, msg) {
  utils.validatePresent(manifest, 'name', ERRORS.NAME.MISSING(msg))
  utils.validateType(manifest.name, 'string', ERRORS.NAME.NOT_STRING(msg))
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
function validateRPC (manifest, plugin, msg) {
  if (!manifest.rpc) {
    return
  }

  utils.validateType(manifest.rpc, Array.isArray, ERRORS.RPC.NOT_ARRAY(msg))

  manifest.rpc.forEach(rpc => {
    utils.validateType(rpc, 'string', ERRORS.RPC.NOT_STRING(msg, rpc))
    utils.validateType(plugin[rpc], 'function', ERRORS.RPC.NOT_IMPLEMENTED(msg, rpc))
  })

  const unique = [...new Set(manifest.rpc.map(rpc => rpc.toLowerCase()))]
  utils.assert(manifest.rpc.length === unique.length, ERRORS.RPC.NOT_UNIQ(msg))

  if (manifest.type === 'payment') {
    utils.assert(manifest.rpc.includes('pay'), ERRORS.RPC.MISSING_PAY(msg))
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
function validateEvents (manifest, plugin, msg) {
  if (!manifest.events) {
    return
  }

  //utils.validateType(plugin.onEvent, 'function', ERRORS.EVENTS.MISSING_LISTENER(msg))
  utils.validateType(manifest.events, Array.isArray, ERRORS.EVENTS.NOT_ARRAY(msg))
  manifest.events.forEach(event => {
    utils.validateType(event, 'string', ERRORS.EVENTS.NOT_STRING(msg, event))
  })

  if (manifest.type === 'payment') {
    utils.assert(manifest.events.includes('receivePayment'), ERRORS.EVENTS.MISSING_WATCH(msg))
  }
}

module.exports = {
  ERRORS,
  validateManifest,
  validateName,
  validateRPC,
  validateEvents
}
