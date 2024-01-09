function createOrderTable (db) {
  const createOrdersStatement = `
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT NOT NULL PRIMARY KEY,
      clientOrderId TEXT NOT NULL,
      state TEXT NOT NULL,
      frequency INTEGER NOT NULL,

      amount TEXT NOT NULL,
      denomination TEXT NOT NULL,
      currency TEXT NOT NULL,

      counterpartyURL TEXT NOT NULL,
      memo TEXT NOT NULL,
      sendingPriority TEXT NOT NULL,

      createdAt INTEGER NOT NULL,
      firstPaymentAt INTEGER NOT NULL,
      lastPaymentAt INTEGER DEFAULT NULL,

      removed INTEGER NOT NULL DEFAULT 0
    )`

  return new Promise((resolve, reject) => {
    db.sqlite.run(createOrdersStatement, (err, res) => {
      if (err) return reject(err)
      return resolve(res)
    })
  })
}

function saveOrder (order) {
  const params = {
    $id: order.id,
    $clientOrderId: order.clientOrderId,
    $state: order.state,
    $frequency: order.frequency,
    $amount: order.amount,
    $denomination: order.denomination,
    $currency: order.currency,
    $counterpartyURL: order.counterpartyURL,
    $memo: order.memo,
    $sendingPriority: JSON.stringify(order.sendingPriority),
    $createdAt: order.createdAt,
    $firstPaymentAt: order.firstPaymentAt,
    $lastPaymentAt: order.lastPaymentAt
  }

  const statement = `
    INSERT INTO orders (
      id,
      clientOrderId,
      state,
      frequency,
      amount,
      denomination,
      currency,
      counterpartyURL,
      memo,
      sendingPriority,
      createdAt,
      firstPaymentAt,
      lastPaymentAt
    ) VALUES (
      $id,
      $clientOrderId,
      $state,
      $frequency,
      $amount,
      $denomination,
      $currency,
      $counterpartyURL,
      $memo,
      $sendingPriority,
      $createdAt,
      $firstPaymentAt,
      $lastPaymentAt
    )`

  return { statement, params }
}

function getOrder (id, opts) {
  const params = { $id: id }
  let statement = 'SELECT * FROM orders WHERE id = $id'

  if (opts.removed === true || opts.removed === 'true' || opts.removed === 1 || opts.removed === '1') {
    statement += ' AND removed = 1'
  } else if (opts.removed === false || opts.removed === 'false' || opts.removed === 0 || opts.removed === '0') {
    statement += ' AND removed = 0'
  }

  statement += ' LIMIT 1'

  return { statement, params }
}

function updateOrder (id, update) {
  let statement = 'UPDATE orders SET '
  const params = { $id: id }

  Object.keys(update).forEach((k, i) => {
    if (k === 'id') return

    statement += `${k} = $${k}`
    if (i !== Object.keys(update).length - 1) statement += ', '

    params[`$${k}`] = (typeof update[k] === 'object') ? JSON.stringify(update[k]) : update[k]
  })

  statement += ' WHERE id = $id'

  return { statement, params }
}
/**
 * @method deserializeOrder - Deserialize an order object
 * @param {Object} order
 * @returns {OrderObject|null}
 */
function deserializeOrder (order) {
  if (!order) return null

  const res = {
    ...order,
    sendingPriority: JSON.parse(order.sendingPriority || '[]')
  }

  delete res.removed

  return res
}

module.exports = {
  createOrderTable,
  saveOrder,
  getOrder,
  updateOrder,
  deserializeOrder
}
