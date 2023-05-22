const orderParams = {
  clientOrderId: 'clientOrderId',
  amount: '100',
  targetURL: 'slashpay://driveKey/slashpay.json',
  sendingPriority: ['p2sh', 'p2tr']
}

const paymentParams = {
  ...orderParams,
  orderId: 'internalOrderId'
}

module.exports = {
  paymentParams,
  orderParams
}
