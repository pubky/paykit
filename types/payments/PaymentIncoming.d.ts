export type Error = {
    /**
     * - no plugins found
     */
    NO_PLUGINS: string;
    /**
     * - not allowed
     */
    NOT_ALLOWED: string;
    /**
     * - no payment file found
     */
    NO_PAYMENT_FILE: string;
    /**
     * - invalid plugin state
     */
    INVALID_PLUGIN_STATE: string;
};
/**
 * PaymentIncoming class
 * @class PaymentIncoming
 * @property {string} id - payment id
 * @property {string} clientOrderId - client payment id
 * @property {string} memo - memo of the payment
 * @property {Amount} amount - amount of the payment
 * @property {PaymentState} internalState - internal state of the payment
 * @property {Date} createdAt - creation timestamp of the payment
 * @property {Date} receivedAt - execution timestamp of the payment
 */
export class PaymentIncoming {
    /**
     * Generate random id
     * @returns {string}
     */
    static generateId(): string;
    /**
     * Validate payment parameters
     * @param {PaymentParams} paymentParams - payment parameters
     * @throws {Error} - if paymentParams is invalid
     * @returns {void}
     */
    static validatePaymentParams(paymentParams: PaymentParams): void;
    /**
     * Validate database
     * @param {DB} db - database
     * @throws {Error} - if db is invalid
     * @returns {void}
     */
    static validateDB(db: DB): void;
    /**
     * Validates payment object
     * @param {Payment} pO - payment object
     * @throws {Error} - if payment object is invalid
     * @returns {void}
     */
    static validatePaymentObject(pO: Payment): void;
    /**
     * @constructor PaymentIncoming
     * @param {PaymentParams} paymentParams
     * @property {string} [paymentParmas.id] - payment object id
     * @property {PaymentState} [paymentParams.internalState] - internal state of the payment
     * @property {string} paymentParams.clientOrderId - client payment id
     * @property {Amount} paymentParams.amount - amount of the payment
     * @param {db} db - database
     * @param {SlashtagsConnector} [slashtagsConnector] - slashtags connector
     */
    constructor(paymentParams: PaymentParams, db: any, slashtagsConnector?: SlashtagsConnector);
    db: any;
    slashtagsConnector: SlashtagsConnector;
    id: any;
    clientOrderId: any;
    memo: any;
    amount: PaymentAmount;
    expectedAmount: PaymentAmount;
    internalState: any;
    receivedByPlugins: any;
    createdAt: any;
    logger: {
        debug: (msg: any) => void;
        info: (msg: any) => void;
    };
    /**
     * Serialize payment object
     * @returns {SerializedPayment}
     */
    serialize(): {
        /**
         * - payment id
         */
        id: string | null;
        /**
         * - client payment id
         * // serialized amount
         */
        clientOrderId: string;
        /**
         * - amount of the payment
         */
        amount: string;
        /**
         * - currency of the payment
         */
        currency: string;
        /**
         * - denomination of the payment
         * // serialized state
         */
        denomination: string;
    };
    /**
     * Serialized payment object
     * @typedef {Object} SerializedPayment
     * @property {string|null} id - payment id
     * @property {string} clientOrderId - client payment id
     * // serialized amount
     * @property {string} amount - amount of the payment
     * @property {string} currency - currency of the payment
     * @property {string} denomination - denomination of the payment
     * // serialized state
     */
    /**
     * Save payment object to db - if persist is true, payment will be saved to db,
     * otherwise it will return { statement, params } query object
     * @returns {Promise<Database| { statement: string, params: object }>}
     * @throws {Error} - if payment object is not valid
     */
    save(persist?: boolean): Promise<Database | {
        statement: string;
        params: object;
    }>;
    /**
     * Soft Delete payment from db
     * @param {boolean} force - force delete
     * @returns {Promise<void>}
     */
    delete(force?: boolean): Promise<void>;
    /**
     * Update payment in db - if persist is true, payment will be updated in db,
     * otherwise it will return { statement, params } query object
     * @returns {Promise<Database| { statement: string, params: object }>}
     * @throws {Error} - if payment is not valid
     */
    update(persist?: boolean): Promise<Database | {
        statement: string;
        params: object;
    }>;
}
import { PAYMENT_STATE } from "./PaymentState";
import { PLUGIN_STATE } from "./PaymentState";
export namespace ERRORS {
    const ID_REQUIRED: string;
    const PARAMS_REQUIRED: string;
    const PAYMENT_OBJECT_REQUIRED: string;
    function ALREADY_EXISTS(id: any): string;
    const NO_DB: string;
    const DB_NOT_READY: string;
    const NOT_ALLOWED: string;
    const NO_PAYMENT_FILE: string;
    function INVALID_PLUGIN_STATE(state: any): string;
}
import { PaymentAmount } from "./PaymentAmount";
export { PAYMENT_STATE, PLUGIN_STATE };
