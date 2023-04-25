const utils = require('../../utils')

function validatePaymentParams (paymentParams, msg) {
  utils.validatePresent(paymentParams, msg)

  validateOrderId(paymentParams.orderId, msg)
  validateClientOrderId(paymentParams.clientOrderId, msg)
  validateAmount(paymentParams.amount, msg)
  validateTargetURL(paymentParams.targetURL, msg)
}

function validateTargetURL (targetURL, msg) {
  utils.validatePresent(targetURL, msg)
  utils.validateType(targetURL, 'string', msg)
  utils.validateNotEmpty(targetURL, msg)

  // TODO: validate URL
}

function validateAmount (amount, msg) {
  utils.validatePresent(amount, msg)
  utils.validateType(amount, 'string', msg)
  utils.validateNotEmpty(amount, msg)
  utils.validateNumericString(amount, msg)
}

function validateClientOrderId (clientOrderId, msg) {
  utils.validatePresent(clientOrderId, msg)
  utils.validateType(clientOrderId, 'string', msg)
  utils.validateNotEmpty(clientOrderId, msg)
}

function validateOrderId (orderId, msg) {
  utils.validatePresent(orderId, msg)
  utils.validateType(orderId, 'string', msg)
  utils.validateNotEmpty(orderId, msg)
}

module.exports = {
  validatePaymentParams
}
