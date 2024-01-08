function createIncomingPaymentTable (db) {
  // TODO:
  // * exepected amount (for invoices only)
  // * 
  // * fail if currencies do not match(
  
    const createPaymentsStatement = `
      CREATE TABLE IF NOT EXISTS incoming_payments (
        id TEXT NOT NULL PRIMARY KEY,
        clientOrderId TEXT NOT NULL,
        memo TEXT NOT NULL,
        amount TEXT,
        denomination TEXT,
        currency TEXT,
        expectedAmount TEXT,
        expectedDenomination TEXT,
        expectedCurrency TEXT,
        receivedByPlugin TEXT,
        createdAt INTEGER NOT NULL,
        receivedAt INTEGER,
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
    $clientOrderId: payment.clientOrderId,
    $memo: payment.memo,
    $amount: payment.amount,
    $denomination: payment.denomination,
    $currency: payment.currency,
    $expectedAmount: payment.expectedAmount,
    $expectedDenomination: payment.expectedDenomination,
    $expectedCurrency: payment.expectedCurrency,
    $receivedByPlugin: JSON.stringify(payment.receivedByPlugin),
    $createdAt: payment.createdAt,
    $receivedAt: payment.executeAt
  }

  const statement = `
    INSERT INTO incoming_payments (
      id,
      clientOrderId,
      memo,
      amount,
      denomination,
      currency,
      expectedAmount,
      expectedDenomination,
      expectedCurrency,
      receivedByPlugin,
      createdAt,
      receivedAt
    ) VALUES (
      $id,
      $clientOrderId,
      $memo,
      $amount,
      $denomination,
      $currency,
      $expectedAmount,
      $expectedDenomination,
      $expectedCurrency,
      $receivedByPlugin,
      $createdAt,
      $receivedAt
    )`

  return { statement, params }
}

function getPayment(id, opts) {
  const params = { $id: id }
  let statement = 'SELECT * FROM incoming_payments WHERE id = $id'

  if (opts.removed === true || opts.removed === 'true' || opts.removed === 1 || opts.removed === '1') {
    statement += ' AND removed = 1'
  } else if (opts.removed === false || opts.removed === 'false' || opts.removed === 0 || opts.removed === '0') {
    statement += ' AND removed = 0'
  }

  statement += ' LIMIT 1'

  return { statement, params }
}

function updatePayment(id, update) {
  let statement = 'UPDATE incoming_payments SET '
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
  let statement = 'SELECT * FROM incoming_payments'
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
    receivedByPlugin: JSON.parse(payment.receivedByPlugin || '{}')
  }

  delete res.removed

  return res
}



module.exports = {
  createIncomingPaymentTable,
  savePayment,
  getPayment,
  updatePayment,
  getPayments,
  deserializePayment,
}
