const { assert } = require('../utils');

const SUPPORTED_CURRENCIES = ['BTC'];

function validateOrderId(orderId) {
  assert(orderId, 'orderId is required');
  assert(typeof orderId === 'string', 'orderId must be a string');
  assert(orderId.length === 36, 'orderId must be 36 characters long');
}

function validateClientOrderId(clientOrderId) {
  assert(clientOrderId, 'clientOrderId is required');
  assert(typeof clientOrderId === 'string', 'clientOrderId must be a string');
  assert(clientOrderId.length === 36, 'clientOrderId must be 36 characters long');
}

function validateAmount(amount) {
  assert(amount, 'amount is required');
  assert(typeof amount === 'string', 'amount must be a string');
  assert(amount.length > 0, 'amount must be non-empty');
  assert(/^\d+?$/.test(amount), 'amount must be a numeric string');
}
function validateCurrency(currency) {
  assert(currency, 'currency is required');
  assert(typeof currency === 'string', 'currency must be a string');
  assert(currency.length === 3, 'currency must be 3 characters long');
  assert(/^[A-Z]+$/.test(currency), 'currency must be an uppercase string');
  assert(SUPPORTED_CURRENCIES.includes(currency), `supported currencies are ${SUPPORTED_CURRENCIES.join(', ')}`);
}

function validateDenomination(denomination) {
  assert(denomination, 'denomination is required');
  assert(typeof denomination === 'string', 'denomination must be a string');
  assert(denomination.length > 0, 'denomination must be non-empty');
  assert(['MAIN', 'BASE'].includes(denomination), 'denomination must be either MAIN or BASE');
}

function validateTargetURL(targetURL) {
  assert(targetURL, 'targetURL is required');
  assert(typeof targetURL === 'string', 'targetURL must be a string');
  assert(targetURL.length > 0, 'targetURL must be non-empty');

  // TODO:
}

function validateSendingPriority(sendingPriority) {
  assert(sendingPriority, 'sendingPriority is required');
  assert(Array.isArray(sendingPriority), 'sendingPriority must be an array');
  assert(sendingPriority.length > 0, 'sendingPriority must be non-empty');

  // TODO: supported plugins
}

function validateInternalState() {}



