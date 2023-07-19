const { v4: uuidv4 } = require('uuid')

const orderParams = {
  clientOrderId: 'clientOrderId',
  amount: '100',
  sendingPriority: ['p2sh', 'p2tr']
}

const paymentParams = {
  ...orderParams,
  orderId: uuidv4(), // XXX this should exist
}

module.exports = {
  paymentParams,
  orderParams
}
