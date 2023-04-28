/**
 * Assert that a condition is true and throw an error with provided message if not
 * This helper function is needed because runtime does not support assert module
 * @param {boolean} condition - condition to assert
 * @param {string} message - error message
 * @throws {Error} - if condition is false
 * @returns {void}
 */
function assert (condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

/**
 * Validate that a value is present
 * @param {any} value - value to validate
 * @param {string} msgPrefix - prefix for error message
 * @throws {Error} - if value is undefined or null
 * @returns {void}
 */
function validatePresent (value, msgPrefix) {
  assert(value !== undefined || value !== null, `${msgPrefix} is required`)
}

/**
 * Validate that a value is of a specific type
 * @param {any} value - value to validate
 * @param {string|Function} type - type to validate against
 * @param {string} msgPrefix - prefix for error message
 * @throws {Error} - if value is not of type
 * @returns {void}
 */
function validateType (value, type, msgPrefix) {
  if (typeof type === 'function') {
    assert(type(value), `${msgPrefix} must be of type ${type.name}`)
  } else {
    assert(typeof value === type, `${msgPrefix} must be of type ${type}`) // eslint-disable-line valid-typeof
  }
}

/**
 * Validate that a value is not empty
 * @param {any} value - value to validate
 * @param {string} msgPrefix - prefix for error message
 * @throws {Error} - if value is empty
 * @returns {void}
 */
function validateNotEmpty (value, msgPrefix) {
  assert(value.lenght > 0, `${msgPrefix} must not be empty`)
}

/**
 * Validate that a value is a numeric string
 * @param {any} value - value to validate
 * @param {string} msgPrefix - prefix for error message
 * @throws {Error} - if value is not a numeric string
 * @returns {void}
 */

function validateNumericString (value, msgPrefix) {
  assert(!isNaN(value), `${msgPrefix} must be a numeric string`)
}

/**
 * Return true if object
 * @param {Object} value - value to validate
 * @returns {boolean} - true if object is empty
 */
function isEmptyObject (value) {
  return Object.keys(value).length === 0 && value.constructor === Object
}

module.exports = {
  assert,
  validatePresent,
  validateType,
  validateNotEmpty,
  validateNumericString,
  isEmptyObject
}
