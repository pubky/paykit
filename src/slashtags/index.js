const b4a = require('b4a')

const { Client } = require('@synonymdev/web-relay')
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
 * @property {client} client - core data instance
 */
class SlashtagsConnector {
  constructor (params) {
    this.client = new Client(params)
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

  /**
   * Read a file from local drive
   * @param {string} path - path to the file
   * @returns {Promise<Object|null>} - content of the file or null
   * @throws {Error} - if path is not valid
   */
  async readLocal (path = SLASHPAY_PATH) {
    const buf = await this.client.get(path)
    return buf && decode(buf)
  }

  /**
   * Read a file from remote drive
   * @param {string} url - url to the file
   * @param {Object} opts
   * @returns {Promise<Object|null>} - content of the file or null
   * @throws {Error} - if url is not valid
   */
  async readRemote (url, opts = {}) {
    let parsed
    try {
      parsed = SlashtagsURL.parse(url)
    } catch (e) {
      throw new Error(ERRORS.INVALID_URL)
    }

    const path = parsed.path ? url : url + SLASHPAY_PATH
    const buf = await this.client.get(path, opts)

    return buf && decode(buf)
  }

  /**
   * Update url
   * @param {string} url - url to the file
   * @param {Object} update - update to be applied
   * @returns {string} - updated url
   * @throws {Error} - if url is not valid
   */
  updateUrl (url, update = {}) {
    const parsed = SlashtagsURL.parse(url)
    Object.assign(parsed, update)
    return SlashtagsURL.format(parsed.key, parsed)
  }

  /**
   * Write a file
   * @param {string} key - path to file
   * @param {Object} value - object to be stored
   * @param {Object} opts
   * @returns {Promise<string>} - url to the file
   * @throws {Error} - if value is not valid JSON
   */
  async create (key, value, opts = {}) {
    SlashtagsConnector.validate(value)

    if (key === SLASHPAY_PATH) {
      await this.client.put(key, encode(value), opts)

      return this.client.createURL(key, opts)
    }

    let index = await this.readLocal(SLASHPAY_PATH, opts)
    if (!index) {
      index = { paymentEndpoints: {} }
      await this.client.put(SLASHPAY_PATH, encode(index), opts)
    }

    const { paymentEndpoints } = index
    if (!paymentEndpoints) throw new Error(ERRORS.MALFORMED_INDEX)
    await this.client.put(key, encode(value), opts)

    const name = key.split('/').pop().split('.')[0]
    paymentEndpoints[name] = key
    await this.update(SLASHPAY_PATH, index, opts)

    return this.client.createURL(key, opts)
  }

  /**
   * Get url to a drive
   * @returns {string}
   */
  async getUrl (path = SLASHPAY_PATH, opts) {
    return await this.client.createURL(path, opts)
  }

  /**
   * Update a file
   * @param {string} key - path to file
   * @param {Object} value - new value
   * @param {Object} opts
   * @returns {Promise<void>}
   * @throws {Error} - if value is not valid JSON
   */
  async update (key, value, opts = {}) {
    SlashtagsConnector.validate(value)

    await this.client.put(key, encode(value), opts)
  }

  /**
   * Delete a file or all files
   * @param {string} key - path to file
   * @param {Object} opts
   * @returns {Promise<void>}
   * @throws {Error} - if index is not found
   * @throws {Error} - if file is not referenced in index
   */
  async delete (key = SLASHPAY_PATH, opts = {}) {
    const index = await this.readLocal(SLASHPAY_PATH, opts)
    if (!index) throw new Error(ERRORS.INDEX_NOT_FOUND)

    const { paymentEndpoints } = index
    if (!paymentEndpoints) throw new Error(ERRORS.MALFORMED_INDEX)

    if (key === SLASHPAY_PATH) {
      const paths = Object.values(paymentEndpoints)
      await Promise.all(paths.map(path => this.client.del(path, opts)))
      await this.client.del(key, opts)
      return
    }

    const entries = Object.entries(paymentEndpoints)
    const pair = entries.find(([_, path]) => path === key)
    if (!pair) throw new Error(ERRORS.FILE_NOT_REFERENCED)

    await this.client.del(pair[1], opts)
    delete paymentEndpoints[pair[0]]

    await this.update(SLASHPAY_PATH, index, opts)
  }

  /**
   * Close the connection to the underlying storage.
   * @returns {Promise<void>}
   */
  async close () {
    await this.client.close()
  }
}
/**
 * @typedef {Object} Error
 * @property {string} INVALID_JSON - Invalid JSON
 * @property {string} INVALID_URL - Invalid URL
 * @property {string} INDEX_NOT_FOUND - Index not found
 * @property {string} FILE_NOT_REFERENCED - File not referenced
 * @property {string} MALFORMED_INDEX - Malformed index
 */
const ERRORS = {
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
