const b4a = require('b4a')

const CoreData = require('@synonymdev/slashtags-core-data')
const SlashURL = require('@synonymdev/slashtags-url')

const ERROR = {
  NOT_READY: 'SlashtagsAccessObject is not ready'
}

const SLASHPAY_PATH = '/public/slashpay.json'

class SlashtagsAccessObject {
  constructor (coreData) {
    if (coreData instanceof CoreData) {
      this.coreData = coreData
    } else {
      this.coreData = new CoreData(coreData)
    }
  }

  async init () {
    await this.coreData.ready()
  }

  async read (key) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    if (!key) {
      const buf = await this.coreData.read(PROFILE_PATH)

      return buf && decode(buf)
    }

    const parsed = SlashURL.parse(key)
    /*
     * if key is a drive key then readRemote by default path
     */

    /*
     * if key is a URL then readRemote by that URL
     */


    return {
      paymentEndpoints: {
        lightning: '/lightning/slashpay.json',
        p2sh: '/p2sh/slashpay.json',
        p2tr: '/p2tr/slashpay.json'
      }
    }
  }

  async create (key, value) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    validate(value)

    await this.coreData.create(key, encode(value), opts)

    // TODO: join path?
    return this.coreData.url
  }

  async delete (key = SLASHPAY_PATH, opts = {}) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    // TODO: read paths from local
    // handle if key does not exist???
    // delete each read one and delete key

    await this.coreData.delete(key, opts)
  }

  async update (value, key = SLASHPAY_PATH, opts = {}) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)
    validate(value)

    await this.coreData.update(key, encode(value), opts)
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
  SlashtagsAccessObject,
  ERROR
}
