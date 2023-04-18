const ERROR = {
  NOT_READY: 'DB is not ready'
}
class DB {
  constructor () {
    this.db = {}
    this.ready = false
  }

  async init () {
    this.ready = true
  }

  async save (payment) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    this.db[payment.id] = {
      ...payment,
      removed: false
    }
  }

  async update (id, update) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    this.db[id] = {
      ...this.db[id],
      ...update
    }
  }

  async delete (id) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    delete this.db[id]
  }

  async get (id, options = { removed: false }) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    const res = this.db[id]
    if (!res) return null

    const copy = { ...res }
    delete copy.removed

    if (options.removed === '*') return copy
    if (options.removed === true) return res.removed === true ? copy : null
    if (options.removed === false) return res.removed === false ? copy : null
  }
}

module.exports = { DB, ERROR }
