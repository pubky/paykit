/**
 * Assert that a condition is true and throw an error with provided message if not
 * This helper function is needed because runtime does not support assert module
 * @param {boolean} condition - condition to assert
 * @param {string} message - error message
 * @throws {Error} - if condition is false
 * @returns {void}
 */
export function assert(condition: boolean, message: string): void;
/**
 * Validate that a value is present
 * @param {any} value - value to validate
 * @param {string} msgPrefix - prefix for error message
 * @throws {Error} - if value is undefined or null
 * @returns {void}
 */
export function validatePresent(value: any, msgPrefix: string): void;
/**
 * Validate that a value is of a specific type
 * @param {any} value - value to validate
 * @param {string|Function} type - type to validate against
 * @param {string} msgPrefix - prefix for error message
 * @throws {Error} - if value is not of type
 * @returns {void}
 */
export function validateType(value: any, type: string | Function, msgPrefix: string): void;
/**
 * Validate that a value is not empty
 * @param {any} value - value to validate
 * @param {string} msgPrefix - prefix for error message
 * @throws {Error} - if value is empty
 * @returns {void}
 */
export function validateNotEmpty(value: any, msgPrefix: string): void;
/**
 * Validate that a value is a numeric string
 * @param {any} value - value to validate
 * @param {string} msgPrefix - prefix for error message
 * @throws {Error} - if value is not a numeric string
 * @returns {void}
 */
export function validateNumericString(value: any, msgPrefix: string): void;
/**
 * Return true if object
 * @param {Object} value - value to validate
 * @returns {boolean} - true if object is empty
 */
export function isEmptyObject(value: any): boolean;
