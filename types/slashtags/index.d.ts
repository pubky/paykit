export type Error = {
    /**
     * - SlashtagsConnector is not ready
     */
    NOT_READY: string;
    /**
     * - Invalid JSON
     */
    INVALID_JSON: string;
    /**
     * - Invalid URL
     */
    INVALID_URL: string;
    /**
     * - Index not found
     */
    INDEX_NOT_FOUND: string;
    /**
     * - File not referenced
     */
    FILE_NOT_REFERENCED: string;
    /**
     * - Malformed index
     */
    MALFORMED_INDEX: string;
};
/**
 * SlashtagsConnector class
 * @class SlashtagsConnector
 * @param {Object} params - parameters for core data
 * @property {{secretKey: Uint8Array, publicKey: Uint8Array}} [params.keyPair]
 * @property {Uint8Array[]} [params.seeders] Seeders' public keys
 * @property {Hyperswarm} [params.swarm]
 * @property {Corestore} [params.corestore]
 * @property {string | object} [params.storage] storage path or Random Access Storage instance
 * @property {Array<{host: string, port: number}>} [params.bootstrap] bootstrapping nodes for HyperDHT
 * @property {Uint8Array} [params.seedersTopic] topic for seeders discovery
 * @property {CoreData} coreData - core data instance
 * @property {boolean} ready - is SlashtagsConnector ready
 */
export class SlashtagsConnector {
    /**
     * Validate data
     * @param {Object|string} data - data to validate
     * @throws {Error} - if data is not valid JSON
     * @throws {Error} - if data is empty object
     */
    static validate(data: any | string): void;
    constructor(params: any);
    coreData: any;
    ready: boolean;
    /**
     * Initialize SlashtagsConnector
     * @returns {Promise<void>}
     */
    init(): Promise<void>;
    /**
     * Read a file from local drive
     * @param {string} path - path to the file
     * @returns {Promise<Object|null>} - content of the file or null
     * @throws {Error} - if SlashtagsConnector is not ready
     * @throws {Error} - if path is not valid
     */
    readLocal(path?: string): Promise<any | null>;
    /**
     * Read a file from remote drive
     * @param {string} url - url to the file
     * @param {Object} opts
     * @returns {Promise<Object|null>} - content of the file or null
     * @throws {Error} - if SlashtagsConnector is not ready
     * @throws {Error} - if url is not valid
     */
    readRemote(url: string, opts?: any): Promise<any | null>;
    /**
     * Read a file
     * @param {string} key - path to file
     * @param {Object} value - object to be stored
     * @param {Object} opts
     * @returns {Promise<string>} - url to the file
     * @throws {Error} - if SlashtagsConnector is not ready
     * @throws {Error} - if value is not valid JSON
     */
    create(key: string, value: any, opts?: any): Promise<string>;
    /**
     * Get url to a drive
     * @returns {string}
     * @throws {Error} - if SlashtagsConnector is not ready
     */
    getUrl(): string;
    /**
     * Update a file
     * @param {string} key - path to file
     * @param {Object} value - new value
     * @param {Object} opts
     * @returns {Promise<void>}
     * @throws {Error} - if SlashtagsConnector is not ready
     * @throws {Error} - if value is not valid JSON
     */
    update(key: string, value: any, opts?: any): Promise<void>;
    /**
     * Delete a file or all files
     * @param {string} key - path to file
     * @param {Object} opts
     * @returns {Promise<void>}
     * @throws {Error} - if SlashtagsConnector is not ready
     * @throws {Error} - if index is not found
     * @throws {Error} - if file is not referenced in index
     */
    delete(key?: string, opts?: any): Promise<void>;
    /**
     * Close the connection to the underlying storage.
     * @returns {Promise<void>}
     */
    close(): Promise<void>;
}
export namespace ERRORS {
    const NOT_READY: string;
    const INVALID_JSON: string;
    const INVALID_URL: string;
    const INDEX_NOT_FOUND: string;
    const FILE_NOT_REFERENCED: string;
    const MALFORMED_INDEX: string;
}
export const SLASHPAY_PATH: "/public/slashpay.json";
