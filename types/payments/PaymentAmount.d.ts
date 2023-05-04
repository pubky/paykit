/**
 * PaymentAmount
 * @class PaymentAmount represents the amount of a payment
 * @param {Object} params
 * @param {String} params.amount - amount in denomination
 * @param {String} params.currency - currency code
 * @param {String} params.denomination - denomination
 */
export class PaymentAmount {
    /**
     * @static validate
     * @param {Object} params - params to validate
     * @throws {ERROR} if params are invalid
     * @returns {void}
     */
    static validate(params: any): void;
    /**
     * @static validateAmount
     * @param {String} amount - amount to validate
     * @throws {ERROR} if amount is invalid
     * @returns {void}
     */
    static validateAmount(amount: string): void;
    /**
     * @static validateCurrency
     * @param {String} currency - currency to validate
     * @throws {ERROR} if currency is invalid
     * @returns {void}
     */
    static validateCurrency(currency: string): void;
    /**
     * @static validateDenomination
     * @param {String} denomination - denomination to validate
     * @throws {ERROR} if denomination is invalid
     * @returns {void}
     */
    static validateDenomination(denomination: string): void;
    constructor({ amount, currency, denomination }: {
        amount: any;
        currency?: string;
        denomination?: string;
    });
    amount: any;
    currency: string;
    denomination: string;
    /**
     * @returns {Object} serialized PaymentAmount
     */
    serialize(): any;
}
/**
 * @constant ERRORS
 * @type {Object} ERRORS
 * @property {String} PARAMS_REQUIRED - params are required
 * @property {String} AMOUNT_REQUIRED - amount is required
 * @property {String} AMOUNT_MUST_BE_NUMBERIC_STRING - amount must be a numberic string
 * @property {String} AMOUNT_MUST_BE_POSITIVE_INTEGER - amount must be positive integer
 * @property {String} AMOUNT_EXCEEDS_MAX - amount exceeds 16 digits
 * @property {String} CURRENCY_REQUIRED - currency is required
 * @property {String} NOT_SUPPORTED_CURRENCY - not supported currency
 * @property {String} DENOMINATION_REQUIRED - denomination is required
 * @property {String} NOT_SUPPORTED_DENOMINATION - not supported denomination
 */
export const ERRORS: any;
/**
 * @constant CURRENCIES
 * @type {Array} CURRENCIES
 * @property {String} BTC - bitcoin
 */
export const CURRENCIES: any[];
/**
 * @constant DENOMINATIONS
 * @type {Array} DENOMINATIONS
 * @property {String} BASE - satoshi
 * @property {String} MAIN - bitcoin
 */
export const DENOMINATIONS: any[];
