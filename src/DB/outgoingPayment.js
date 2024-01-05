
function createOutgoingPaymentTable (db) {
    const createPaymentsStatement = `
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT NOT NULL PRIMARY KEY,
        orderId TEXT NOT NULL,
        clientOrderId TEXT NOT NULL,
        counterpartyURL TEXT NOT NULL,
        memo TEXT NOT NULL,
        sendingPriority TEXT NOT NULL,
        amount TEXT NOT NULL,
        denomination TEXT NOT NULL,
        currency TEXT NOT NULL,
        internalState TEXT NOT NULL,
        pendingPlugins TEXT NOT NULL,
        triedPlugins TEXT NOT NULL,
        currentPlugin TEXT NOT NULL,
        completedByPlugin TEXT NOT NULL,
        direction TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        executeAt INTEGER NOT NULL,
        removed INTEGER NOT NULL DEFAULT 0
      )`

    return new Promise((resolve, reject) => {
      db.sqlite.run(createPaymentsStatement, (err, res) => {
        if (err) return reject(err)
        return resolve(res)
      })
    })
}

function savePayment(payment) {
  const params = {
    $id: payment.id,
    $orderId: payment.orderId,
    $clientOrderId: payment.clientOrderId,
    $counterpartyURL: payment.counterpartyURL,
    $memo: payment.memo,
    $sendingPriority: JSON.stringify(payment.sendingPriority),
    $amount: payment.amount,
    $denomination: payment.denomination,
    $currency: payment.currency,
    $internalState: payment.internalState,
    $pendingPlugins: JSON.stringify(payment.pendingPlugins),
    $triedPlugins: JSON.stringify(payment.triedPlugins),
    $currentPlugin: JSON.stringify(payment.currentPlugin),
    $completedByPlugin: JSON.stringify(payment.completedByPlugin),
    $direction: payment.direction,
    $createdAt: payment.createdAt,
    $executeAt: payment.executeAt
  }

  const statement = `
    INSERT INTO payments (
      id,
      orderId,
      clientOrderId,
      counterpartyURL,
      memo,
      sendingPriority,
      amount,
      denomination,
      currency,
      internalState,
      pendingPlugins,
      triedPlugins,
      currentPlugin,
      completedByPlugin,
      direction,
      createdAt,
      executeAt
    ) VALUES (
      $id,
      $orderId,
      $clientOrderId,
      $counterpartyURL,
      $memo,
      $sendingPriority,
      $amount,
      $denomination,
      $currency,
      $internalState,
      $pendingPlugins,
      $triedPlugins,
      $currentPlugin,
      $completedByPlugin,
      $direction,
      $createdAt,
      $executeAt
    )`

  return { statement, params }
}

function getPayment(id, opts) {
  const params = { $id: id }
  let statement = 'SELECT * FROM payments WHERE id = $id'

  if (opts.removed === true || opts.removed === 'true' || opts.removed === 1 || opts.removed === '1') {
    statement += ' AND removed = 1'
  } else if (opts.removed === false || opts.removed === 'false' || opts.removed === 0 || opts.removed === '0') {
    statement += ' AND removed = 0'
  }

  statement += ' LIMIT 1'

  return { statement, params }
}

function updatePayment(id, update) {
  let statement = 'UPDATE payments SET '
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

function getPayments(opts) {
  const params = {}
  let statement = 'SELECT * FROM payments'
  if (Object.keys(opts).length > 0) statement += ' WHERE '
  Object.keys(opts).forEach((k, i) => {
    statement += ` ${k} = $${k}`
    if (i !== Object.keys(opts).length - 1) statement += ' AND '

    if (typeof opts[k] !== 'string') throw new Error('Only string params are supported')

    params[`$${k}`] = opts[k]
  })

  statement += ' ORDER BY createdAt DESC'
  return { statement, params }
}

/**
 * @method deserializePayment - Deserialize a payment object
 * @param {Object} payment
 * @returns {PaymentObject|null}
 */
function deserializePayment (payment) {
  if (!payment) return null

  const res = {
    ...payment,
    sendingPriority: JSON.parse(payment.sendingPriority || '[]'),
    pendingPlugins: JSON.parse(payment.pendingPlugins || '[]'),
    triedPlugins: JSON.parse(payment.triedPlugins || '[]'),
    currentPlugin: JSON.parse(payment.currentPlugin || '{}'),
    completedByPlugin: JSON.parse(payment.completedByPlugin || '{}')
  }

  delete res.removed

  return res
}



module.exports = {
  createOutgoingPaymentTable,
  savePayment,
  getPayment,
  updatePayment,
  getPayments,
  deserializePayment,
}
