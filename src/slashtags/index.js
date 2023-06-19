const b4a = require('b4a')

const CoreData = require('@synonymdev/slashtags-core-data')
const SlashtagsURL = require('@synonymdev/slashtags-url')

// NOTE: do not like idea of signaling encrypted vs unencrypted data via path
const SLASHPAY_PATH = '/public/slashpay.json'

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
class SlashtagsConnector {
  constructor (params) {
    this.coreData = new CoreData(params)
    this.ready = false
  }

  /**
   * Validate data
   * @param {Object|string} data - data to validate
   * @throws {Error} - if data is not valid JSON
   * @throws {Error} - if data is empty object
   */
  static validate (data) {
    if (!data) throw new Error(ERRORS.INVALID_JSON)

    let value
    try {
      value = typeof data === 'string' ? JSON.parse(value) : data
    } catch (e) {
      throw new Error(ERRORS.INVALID_JSON)
    }

    if (typeof value === 'object' && value !== null) {
      if (Object.keys(value).length === 0) throw new Error(ERRORS.INVALID_JSON)
    } else {
      throw new Error(ERRORS.INVALID_JSON)
    }
  }

  /**
   * Initialize SlashtagsConnector
   * @returns {Promise<void>}
   */
  async init () {
    if (this.ready) return

    await this.coreData.ready()
    this.ready = true
  }

  /**
   * Read a file from local drive
   * @param {string} path - path to the file
   * @returns {Promise<Object|null>} - content of the file or null
   * @throws {Error} - if SlashtagsConnector is not ready
   * @throws {Error} - if path is not valid
   */
  async readLocal (path = SLASHPAY_PATH) {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)

    const buf = await this.coreData.read(path)
    return buf && decode(buf)
  }

  /**
   * Read a file from remote drive
   * @param {string} url - url to the file
   * @param {Object} opts
   * @returns {Promise<Object|null>} - content of the file or null
   * @throws {Error} - if SlashtagsConnector is not ready
   * @throws {Error} - if url is not valid
   */
  async readRemote (url, opts = {}) {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)

    let parsed
    try {
      parsed = SlashtagsURL.parse(url)
    } catch (e) {
      throw new Error(ERRORS.INVALID_URL)
    }

    const path = parsed.path ? url : url + SLASHPAY_PATH
    const buf = await this.coreData.readRemote(path, opts)

    return buf && decode(buf)
  }

  /**
   * Read a file
   * @param {string} key - path to file
   * @param {Object} value - object to be stored
   * @param {Object} opts
   * @returns {Promise<string>} - url to the file
   * @throws {Error} - if SlashtagsConnector is not ready
   * @throws {Error} - if value is not valid JSON
   */
  async create (key, value, opts = {}) {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)
    SlashtagsConnector.validate(value)

    // NOTE: url should be an object to support `join` and `toString`. If path is not public, key should be included
    const res = this.getUrl() + key

    if (key === SLASHPAY_PATH) {
      await this.coreData.create(key, encode(value), opts)
      return res
    }

    let index = await this.readLocal(SLASHPAY_PATH, opts)
    if (!index) {
      index = { paymentEndpoints: {} }
      await this.coreData.create(SLASHPAY_PATH, encode(index), opts)
    }

    const { paymentEndpoints } = index
    if (!paymentEndpoints) throw new Error(ERRORS.MALFORMED_INDEX)
    await this.coreData.create(key, encode(value), opts)

    const name = key.split('/').pop().split('.')[0]
    paymentEndpoints[name] = key
    await this.update(SLASHPAY_PATH, index, opts)

    return res
  }

  /**
   * Get url to a drive
   * @returns {string}
   * @throws {Error} - if SlashtagsConnector is not ready
   */
  getUrl () {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)

    return this.coreData.url
  }

  /**
   * Update a file
   * @param {string} key - path to file
   * @param {Object} value - new value
   * @param {Object} opts
   * @returns {Promise<void>}
   * @throws {Error} - if SlashtagsConnector is not ready
   * @throws {Error} - if value is not valid JSON
   */
  async update (key, value, opts = {}) {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)
    SlashtagsConnector.validate(value)

    await this.coreData.update(key, encode(value), opts)
  }

  /**
   * Delete a file or all files
   * @param {string} key - path to file
   * @param {Object} opts
   * @returns {Promise<void>}
   * @throws {Error} - if SlashtagsConnector is not ready
   * @throws {Error} - if index is not found
   * @throws {Error} - if file is not referenced in index
   */
  async delete (key = SLASHPAY_PATH, opts = {}) {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)

    const index = await this.readLocal(SLASHPAY_PATH, opts)
    if (!index) throw new Error(ERRORS.INDEX_NOT_FOUND)

    const { paymentEndpoints } = index
    if (!paymentEndpoints) throw new Error(ERRORS.MALFORMED_INDEX)

    if (key === SLASHPAY_PATH) {
      const paths = Object.values(paymentEndpoints)
      await Promise.all(paths.map(path => this.coreData.delete(path, opts)))
      await this.coreData.delete(key, opts)
      return
    }

    const entries = Object.entries(paymentEndpoints)
    const pair = entries.find(([_, path]) => path === key)
    if (!pair) throw new Error(ERRORS.FILE_NOT_REFERENCED)

    await this.coreData.delete(pair[1], opts)
    delete paymentEndpoints[pair[0]]

    await this.update(SLASHPAY_PATH, index, opts)
  }

  /**
   * Close the connection to the underlying storage.
   * @returns {Promise<void>}
   */
  async close () {
    await this.coreData.close()
  }
}
/**
 * @typedef {Object} Error
 * @property {string} NOT_READY - SlashtagsConnector is not ready
 * @property {string} INVALID_JSON - Invalid JSON
 * @property {string} INVALID_URL - Invalid URL
 * @property {string} INDEX_NOT_FOUND - Index not found
 * @property {string} FILE_NOT_REFERENCED - File not referenced
 * @property {string} MALFORMED_INDEX - Malformed index
 */
const ERRORS = {
  NOT_READY: 'SlashtagsConnector is not ready',
  INVALID_JSON: 'Invalid JSON',
  INVALID_URL: 'Invalid URL',
  INDEX_NOT_FOUND: 'Index not found',
  FILE_NOT_REFERENCED: 'File not referenced',
  MALFORMED_INDEX: 'Malformed index'
}

/**
 * Encode profile json into Uint8Array.
 *
 * @param {Profile} profile
 *
 * @returns {Uint8Array}
 */
function encode (profile) {
  return b4a.from(JSON.stringify(profile))
}

/**
 * Try to decode Uint8Array into profile json.
 *
 * @param{Uint8Array} buf
 *
 * @returns {Profile | null}
 */
function decode (buf) {
  try {
    return JSON.parse(b4a.toString(buf))
  } catch {
    return null
  }
}

module.exports = {
  SlashtagsConnector,
  ERRORS,
  SLASHPAY_PATH
}
