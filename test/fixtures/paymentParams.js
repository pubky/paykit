const orderParams = {
  clientOrderId: 'clientOrderId',
  amount: '100',
  targetURL: 'slashpay://driveKey/slashpay.json'
}

const paymentParams = {
  ...orderParams,
  orderId: 'internalOrderId'
}

module.exports = {
  paymentParams,
  orderParams
}
