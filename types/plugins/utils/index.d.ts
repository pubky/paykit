export namespace ERRORS {
    const CONFLICT: string;
    function FAILED_TO_LOAD(path: any): string;
    const INVALID_CONFIG_PLUGIN: string;
    namespace NAME {
        function MISSING(msg: any): string;
        function NOT_STRING(msg: any): string;
    }
    namespace RPC {
        export function NOT_ARRAY(msg: any): string;
        export function NOT_STRING_1(msg: any, rpc: any): string;
        export { NOT_STRING_1 as NOT_STRING };
        export function NOT_UNIQ(msg: any): string;
        export function NOT_IMPLEMENTED(msg: any, rpc: any): string;
        export function MISSING_LISTENER(msg: any): string;
        export function MISSING_PAY(msg: any): string;
    }
    namespace EVENTS {
        export function NOT_ARRAY_1(msg: any): string;
        export { NOT_ARRAY_1 as NOT_ARRAY };
        export function NOT_STRING_2(msg: any, event: any): string;
        export { NOT_STRING_2 as NOT_STRING };
        export function MISSING_LISTENER_1(msg: any): string;
        export { MISSING_LISTENER_1 as MISSING_LISTENER };
        export function MISSING_WATCH(msg: any): string;
    }
    namespace PLUGIN {
        function INIT(msg: any): string;
        function GET_MANIFEST(msg: any): string;
        function STOP(msg: any): string;
        function EVENT_DISPATCH(name: any, msg: any): string;
        function NOT_FOUND(name: any): string;
    }
}
/**
 * Validates manifest
 * @param {PluginManifest} manifest - manifest object
 * @param {Plugin} plugin - plugin instance
 * @returns {Promise<void>}
 * @throws {Error} - if manifest is invalid
 */
export function validateManifest(manifest: PluginManifest, plugin: Plugin): Promise<void>;
/**
 * Validates name property of the manifest
 * @param {PluginManifest} manifest - manifest object
 * @param {string} msg - error message prefix
 * @returns {void}
 * @throws {Error} - if name is missing
 */
export function validateName(manifest: PluginManifest, msg: string): void;
/**
 * Validates rpc property of the manifest
 * @param {PluginManifest} manifest - manifest object
 * @param {Plugin} plugin - plugin instance
 * @param {string} msg - error message prefix
 *
 * @returns {void}
 * @throws {Error} - if rpc is not an array or contains non-string elements or is missing
 */
export function validateRPC(manifest: PluginManifest, plugin: Plugin, msg: string): void;
/**
 * Validate events property of the manifest
 * @param {PluginManifest} manifest - manifest object
 * @param {Plugin} plugin - plugin instance
 * @param {string} msg - error message prefix
 * @returns {void}
 * @throws {Error} - if events is not an array or contains non-string elements or is missing
 */
export function validateEvents(manifest: PluginManifest, plugin: Plugin, msg: string): void;
