module.exports = {
  /**
   * Assert that a condition is true and throw an error with provided message if not
   * This helper function is needed because runtime does not support assert module
   * @param {boolean} condition - condition to assert
   * @param {string} message - error message
   * @throws {Error} - if condition is false
   * @returns {void}
   */
  assert: (condition, message) => {
    if (!condition) {
      throw new Error(message)
    }
  }
}
