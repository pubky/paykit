/**
 * Plugin Configuration Object
 */
export type PluginConfig = {
    /**
     * - path to main
     */
    pluginEntryPoint: string;
};
/**
 * Plugin Manifest Object
 */
export type PluginManifest = {
    /**
     * - plugin name
     */
    name: string;
};
/**
 * Storage Object
 */
export type Storage = {
    /**
     * - store value in storage
     */
    create: Function;
    /**
     * - get value from storage
     */
    read: Function;
    /**
     * - update value in storage
     */
    update: update;
    /**
     * - delete value from storage
     */
    delete: delete;
};
export class PluginManager {
    /**
     * Plugin manager class
     * @class PluginManager
     * @constructor
     * @param {Object} config - config object
     * @property {Object[Plugin]} plugins - loaded plugins
     */
    constructor(config: any);
    plugins: {};
    config: any;
    /**
     * Inject plugin into the manager
     * @param {any} module - plugin module object
     * @param {storage} storage - instance with CRUD interface for receiving payments
     * @returns {Promise<Plugin>} - plugin instance
     * @throws {Error} - if plugin is already loaded
     * @throws {Error} - if plugin is not valid
     * @throws {Error} - if plugin failed to initialize
     * @throws {Error} - if plugin failed to get manifest
     */
    injectPlugin(module: any, storage: any): Promise<Plugin>;
    /**
     * Load a plugin with runtime by path to the entry point
     * @param {string} pluginEntryPoint - path to plugins main
     * @param {[Storage]} storage - instance with CRUD interface for receiving payments
     * @returns {Promise<Plugin>} - plugin instance
     * @throws {Error} - if plugin is already loaded
     */
    loadPlugin(pluginEntryPoint: string, storage: [Storage]): Promise<Plugin>;
    /**
     * Disable a plugin by calling its "stop" method
     * @param {string} name - name of the plugin
     */
    stopPlugin(name: string): Promise<void>;
    /**
     * Unload a plugin by removing it from the map of plugins
     * @param {string} name - name of the plugin
     * @returns {boolean} - true if plugin was removed, false if plugin is active and can not be removed
     *
     */
    removePlugin(name: string): boolean;
    /**
     * Get a map of all loaded plugins
     * @param {boolean} isActive - if true, return only active plugins
     * @returns {Object[Plugin]} - map of plugins
     */
    getPlugins(isActive: boolean): any;
    /**
     * Dispatch an event to all active plugins
     * @param {string} event - event name
     * @param {Object} data - event data
     * @returns {Promise<void>}
     */
    dispatchEvent(event: string, data: any): Promise<void>;
    /**
     * Get map with method path as a keys and corresponding plugin methods as values
     * @returns {Object[any]} - map of methods
     */
    getRPCRegistry(): any[any];
    /**
     * Deactivate all plugins and throw an error
     * @param {Error} error - error to throw
     * @throws {Error} - error
     */
    gracefulThrow(error: Error): Promise<void>;
    /**
     * Initialize plugin
     * @param {any} plugin module object
     * @param {storeage} storage - instance with CRUD interface for receiving payments
     * @returns {Promise<Plugin>} - plugin instance
     */
    initPlugin(module: any, storage: storeage): Promise<Plugin>;
    /**
     * Get plugins manifest
     * @returns {Promise<Object>} - manifest
     */
    getManifest(module: any, plugin: any): Promise<any>;
    /**
     * Load plugin by path to the entry point or name if path is in config
     * @param {string} pluginEntryPoint - path to plugins main or plugin name if it is already in config
     * @returns {any} - plugin module
     * @throws {Error} - if plugin failed to load
     */
    loadByPathOrName(pluginEntryPoint: string): any;
}
export const ERRORS: any;
