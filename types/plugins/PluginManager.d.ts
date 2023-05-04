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
}
export const ERRORS: {
    CONFLICT: string;
    FAILED_TO_LOAD: (path: any) => string;
    INVALID_CONFIG_PLUGIN: string;
    NAME: {
        MISSING: (msg: any) => string;
        NOT_STRING: (msg: any) => string;
    }; /**
     * Load a plugin with runtime by path to the entry point
     * @param {string} pluginEntryPoint - path to plugins main
     * @param {[Storage]} storage - instance with CRUD interface for receiving payments
     * @returns {Promise<Plugin>} - plugin instance
     * @throws {Error} - if plugin is already loaded
     */
    RPC: {
        NOT_ARRAY: (msg: any) => string;
        NOT_STRING: (msg: any, rpc: any) => string;
        NOT_UNIQ: (msg: any) => string;
        NOT_IMPLEMENTED: (msg: any, rpc: any) => string;
        MISSING_LISTENER: (msg: any) => string;
        MISSING_PAY: (msg: any) => string;
    };
    EVENTS: {
        NOT_ARRAY: (msg: any) => string;
        NOT_STRING: (msg: any, event: any) => string;
        MISSING_LISTENER: (msg: any) => string;
        MISSING_WATCH: (msg: any) => string;
    };
    PLUGIN: {
        INIT: (msg: any) => string;
        GET_MANIFEST: (msg: any) => string;
        STOP: (msg: any) => string;
        EVENT_DISPATCH: (name: any, msg: any) => string;
        NOT_FOUND: (name: any) => string;
    };
};
