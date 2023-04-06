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
export class PluginManager {
    /**
     * @param {Object} config - configuration object
     * @property {Object[PluginConfig]} config.plugins - array of plugin elements
     */
    constructor(config: any);
    plugins: {};
    config: any;
    /**
     * Load a plugin with runtime by path to the entry point
     * @param {string} pluginEntryPoint - path to plugins main
     * @returns {Promise<Plugin>} - plugin instance
     * @throws {Error} - if plugin is already loaded
     */
    loadPlugin(pluginEntryPoint: string): Promise<Plugin>;
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
     * Validates manifest
     * @param {PluginManifest} manifest - manifest object
     * @returns {Promise<void>}
     * @throws {Error} - if manifest is invalid
     */
    validateManifest(manifest: PluginManifest): Promise<void>;
    /**
     * Validates name property of the manifest
     * @param {PluginManifest} manifest - manifest object
     * @param {string} msg - error message prefix
     * @returns {void}
     * @throws {Error} - if name is missing
     */
    validateName(manifest: PluginManifest, msg: string): void;
    /**
     * Validates rpc property of the manifest
     * @param {PluginManifest} manifest - manifest object
     * @param {string} msg - error message prefix
     * @returns {void}
     * @throws {Error} - if rpc is not an array or contains non-string elements or is missing
     */
    validateRPC(manifest: PluginManifest, msg: string): void;
    /**
     * Validate events property of the manifest
     * @param {PluginManifest} manifest - manifest object
     * @param {string} msg - error message prefix
     * @returns {void}
     * @throws {Error} - if events is not an array or contains non-string elements or is missing
     */
    validateEvents(manifest: PluginManifest, msg: string): void;
    /**
     * Deactivate all plugins and throw an error
     * @param {Error} error - error to throw
     * @throws {Error} - error
     */
    gracefulThrow(error: Error): Promise<void>;
}
export namespace ERRORS {
    const CONFLICT: string;
    const NOT_READABLE: string;
    namespace NAME {
        function MISSING(msg: any): string;
        function NOT_STRING(msg: any): string;
    }
    namespace RPC {
        export function NOT_ARRAY(msg: any): string;
        export function NOT_STRING_1(msg: any, rpc: any): string;
        export { NOT_STRING_1 as NOT_STRING };
        export function NOT_UNIQ(msg: any): string;
    }
    namespace EVENTS {
        export function NOT_ARRAY_1(msg: any): string;
        export { NOT_ARRAY_1 as NOT_ARRAY };
        export function NOT_STRING_2(msg: any, event: any): string;
        export { NOT_STRING_2 as NOT_STRING };
    }
}
