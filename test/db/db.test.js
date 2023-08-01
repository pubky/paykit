const { test } = require('brittle')

const { DB, ERROR } = require('../../src/DB/index.js')

test('cosntructor', async (t) => {
  const db = new DB({ name: 'test', path: './tmp' })

  t.ok(db.db)
  t.is(db.ready, false)
})

test('init', async (t) => {
  const db = new DB({ name: 'test', path: './test_db' })

  await db.init()

  t.is(db.ready, true)
  const statement = `SELECT * FROM sqlite_schema WHERE type ='table' AND name NOT LIKE 'sqlite_%';`

  const res = await (new Promise((resolve, reject) => {
    db.db.sqlite.all(statement, (err, res) => {
      if (err) return reject(err)
      return resolve(res)
    })
  }))

  t.is(res.length, 2)
  t.is(res.find((r) => r.name === 'payments').name, 'payments')
  t.is(res.find((r) => r.name === 'orders').name, 'orders')
})

