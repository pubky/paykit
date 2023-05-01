const ERROR = {
  NOT_READY: 'SlashtagsAccessObject is not ready'
}

class SlashtagsAccessObject {
  constructor (key, directory) {
    this.key = key
    this.directory = directory
    this.ready = false

    this.data = {}
  }

  async init () {
    this.ready = true
  }

  async read (key) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

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

    this.data[key] = value

    return 'randomDriveKey'
  }

  async delete (key) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    delete this.data[key]
  }

  async update (key, value) {
    if (!this.ready) throw new Error(ERROR.NOT_READY)

    this.data[key] = value
  }
}

module.exports = {
  SlashtagsAccessObject,
  ERROR
}
