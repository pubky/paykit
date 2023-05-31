const b4a = require('b4a')

const CoreData = require('@synonymdev/slashtags-core-data')
const SlashtagsURL = require('@synonymdev/slashtags-url')

const ERRORS = {
  NOT_READY: 'SlashtagsConnector is not ready',
  INVALID_JSON: 'Invalid JSON',
  INVALID_URL: 'Invalid URL'
}

// XXX I do not like idea of signaling encrypted vs unencrypted data via path
const SLASHPAY_PATH = '/public/slashpay.json'

class SlashtagsConnector {
  constructor (coreData) {
    // Do we need it?
    if (coreData instanceof CoreData) {
      this.coreData = coreData
    } else {
      this.coreData = new CoreData(coreData)
    }
    this.ready = false
  }

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

  async init () {
    await this.coreData.ready()
    this.ready = true
  }

  async readLocal (path = SLASHPAY_PATH) {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)

    const buf = await this.coreData.read(path)
    return buf && decode(buf)
  }

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

  async create (key, value, opts = {}) {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)
    SlashtagsConnector.validate(value)

    await this.coreData.create(key, encode(value), opts)

    // XXX url should be an object to support `join` and `toString` etc
    // if path is not public, key should be included
    return this.coreData.url + key
  }

  getUrl () {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)

    return this.coreData.url
  }

  async update (key, value, opts = {}) {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)
    SlashtagsConnector.validate(value)

    await this.coreData.update(key, encode(value), opts)
  }

  async delete (key = SLASHPAY_PATH, opts = {}) {
    if (!this.ready) throw new Error(ERRORS.NOT_READY)

    // TODO: read paths from local
    // handle if key does not exist???
    // delete each read one and delete key
    // for partial delete find key in root file and delete
    // delete file by path

    await this.coreData.delete(key, opts)
  }

  async close () {
    await this.coreData.close()
  }
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
