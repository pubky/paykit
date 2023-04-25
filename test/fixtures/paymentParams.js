const orderParams = {
  clientOrderId: 'clientOrderId',
  amount: '100',
  targetURL: 'slashpay://driveKey/slashpay.json',
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
