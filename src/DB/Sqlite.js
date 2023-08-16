const path = require('path')
const fs = require('fs/promises')
const Sqlite3 = require('sqlite3')

const ERROR = {
  DB_NAME_MISSING: 'DB_NAME_MISSING',
  DB_PATH_MISSINT: 'DB_PATH_MISSING',
  CONFIG_MISSING: 'CONFIG_MISSING',
  DB_NOT_READY: 'DB_NOT_INITED'
}

class Sqlite {
  constructor (config) {
    if (!config) throw new Error(ERROR.CONFIG_MISSING)
    if (!config.name) throw new Error(ERROR.DB_NAME_MISSING)
    if (!config.path) throw new Error(ERROR.DB_PATH_MISSING)

    this.config = { ...config }

    this.version = this.config?.version || '0.0.1'
    this.ready = false
    this.dbPath = path.resolve(this.config.path, `sqlite-${this.config.name}-${this.version}.sqlite`)
  }

  async deleteSqlite () {
    if (!this.ready) throw new Error(ERROR.DB_NOT_READY)

    return await fs.unlink(this.dbPath)
  }

  async start () {
    return new Promise((resolve, reject) => {
      this.sqlite = new Sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(err)

        this.ready = true
        resolve()
      })
    })
  }
}

module.exports = { Sqlite, ERROR }
