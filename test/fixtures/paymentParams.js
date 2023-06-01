const orderParams = {
  clientOrderId: 'clientOrderId',
  amount: '100',
  sendingPriority: ['p2sh', 'lightning']
}

const paymentParams = {
  ...orderParams,
  orderId: 'internalOrderId'
}

module.exports = {
  paymentParams,
  orderParams
}
