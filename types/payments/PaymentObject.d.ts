export type Error = {
    /**
     * - no plugins found
     */
    NO_PLUGINS: string;
    /**
     * - clientOrderId is required
     */
    CLIENT_ID_REQUIRED: string;
    /**
     * - counterpartyURL is required
     */
    COUNTERPARTY_REQUIRED: string;
    /**
     * - not allowed
     */
    NOT_ALLOWED: string;
    /**
     * - no payment file found
     */
    NO_PAYMENT_FILE: string;
    /**
     * - invalid payment direction
     */
    INVALID_DIRECTION: string;
    /**
     * - completedByPlugin is required
     */
    COMPLETED_BY_PLUGIN_REQUIRED: string;
    /**
     * - completedByPlugin.name is required
     */
    COMPLETED_BY_PLUGIN_NAME_REQUIRED: string;
    /**
     * - completedByPlugin.state is required
     */
    COMPLETED_BY_PLUGIN_STATE_REQUIRED: string;
    /**
     * - invalid plugin state
     */
    INVALID_PLUGIN_STATE: string;
    /**
     * - completedByPlugin.startAt is required
     */
    COMPLETED_BY_PLUGIN_START_AT_REQUIRED: string;
};
export type PaymentDirection = {
    /**
     * - incoming payment
     */
    IN: string;
    /**
     * - outgoing payment
     */
    OUT: string;
};
/**
 * PaymentObject class
 * @class PaymentObject
 * @property {string} id - payment id
 * @property {string} orderId - order id
 * @property {string} clientOrderId - client payment id
 * @property {string} counterpartyURL - destination of the payment
 * @property {string} memo - memo of the payment
 * @property {string[]} sendingPriority - list of plugins to use to send the payment
 * @property {Amount} amount - amount of the payment
 * @property {PaymentState} internalState - internal state of the payment
 * @property {PaymentDirection} direction - direction of the payment
 * @property {Date} createdAt - creation timestamp of the payment
 * @property {Date} executeAt - execution timestamp of the payment
 */
export class PaymentObject {
    /**
     * Generate random id
     * @returns {string}
     */
    static generateId(): string;
    /**
     * Validate payment direction
     * @param {PaymentDirection} direction - payment direction
     * @throws {Error} - if direction is invalid
     * @returns {void}
     */
    static validateDirection(paymentParams: any): void;
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
     * @constructor PaymentObject
     * @param {PaymentParams} paymentParams
     * @property {string} [paymentParmas.id] - payment object id
     * @property {PaymentState} [paymentParams.internalState] - internal state of the payment
     * @property {string} paymentParams.counterpartyURL - destination of the payment
     * @property {string} paymentParams.clientOrderId - client payment id
     * @property {Amount} paymentParams.amount - amount of the payment
     * @property {string[]} paymentParams.sendingPriority - list of plugins to use to send the payment
     * @param {db} db - database
     * @param {TransportConnector} [transportConnector] - TransportConnector connector
     */
    constructor(paymentParams: PaymentParams, db: any, transportConnector?: TransportConnector);
    db: any;
    sendingPriority: any;
    transportConnector: TransportConnector;
    id: any;
    orderId: any;
    clientOrderId: any;
    direction: any;
    counterpartyURL: any;
    memo: any;
    amount: PaymentAmount;
    internalState: PaymentState;
    createdAt: any;
    executeAt: any;
    logger: {
        debug: (msg: any) => void;
        info: (msg: any) => void;
    };
    /**
     * Connects to remote counterpartyURL and creates local payment priority
     * @returns {Promise<void>}
     * @throws {Error} - if no mutual plugins are available
     */
    init(): Promise<void>;
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
         */
        clientOrderId: string;
        /**
         * - internal state of the payment
         */
        internalState: {
            INITIAL: string;
            IN_PROGRESS: string;
            COMPLETED: string;
            FAILED: string;
            CANCELLED: string;
        };
        /**
         * - destination of the payment
         * // serialized amount
         */
        counterpartyURL: string;
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
        /**
         * - list of plugins to use to send the payment
         */
        sendingPriority: string[];
        /**
         * - list of plugins that processed the payment
         */
        processedBy: string[];
        /**
         * - plugin that is currently processing the payment
         */
        processingPlugin: string | null;
    };
    /**
     * Serialized payment object
     * @typedef {Object} SerializedPayment
     * @property {string|null} id - payment id
     * @property {string} clientOrderId - client payment id
     * @property {PAYMENT_STATE} internalState - internal state of the payment
     * @property {string} counterpartyURL - destination of the payment
     * // serialized amount
     * @property {string} amount - amount of the payment
     * @property {string} currency - currency of the payment
     * @property {string} denomination - denomination of the payment
     * // serialized state
     * @property {string[]} sendingPriority - list of plugins to use to send the payment
     * @property {string[]} processedBy - list of plugins that processed the payment
     * @property {string|null} processingPlugin - plugin that is currently processing the payment
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
    /**
     * Process payment by iterating through sendingPriority and updating internalState
     * @returns {Promise<PaymentObject>}
     */
    process(): Promise<PaymentObject>;
    /**
     * Complete payment by setting internalState to COMPLETED
     * @throws {Error} - if payment is not in progress
     * @returns {Promise<PaymentObject>}
     */
    complete(): Promise<PaymentObject>;
    /**
     * Cancel payment by setting internalState to CANCELED, if persist is true, payment will be updated in db,
     * otherwise it will return { statement, params } query object
     *
     * @throws {Error} - if payment is not initial
     * @returns {Promise<Database| { statement: string, params: object }>}
     */
    cancel(persist?: boolean): Promise<Database | {
        statement: string;
        params: object;
    }>;
    /**
     * get current plugin from state
     * @returns {Plugin|null}
     */
    getCurrentPlugin(): Plugin | null;
    /**
     * fail current plugin
     * @returns {Promise<PaymentObject>}
     */
    failCurrentPlugin(): Promise<PaymentObject>;
    /**
     * checks if payment is in progress
     * @returns {boolean}
     */
    isInProgress(): boolean;
    /**
     * checks if payment is in final state
     * @returns {boolean}
     */
    isFinal(): boolean;
    /**
     * checks if payment is failed
     * @returns {boolean}
     */
    isFailed(): boolean;
}
import { PAYMENT_STATE } from "./PaymentState";
import { PLUGIN_STATE } from "./PaymentState";
export namespace ERRORS {
    const ID_REQUIRED: string;
    const PARAMS_REQUIRED: string;
    const PAYMENT_OBJECT_REQUIRED: string;
    const ORDER_ID_REQUIRED: string;
    function ALREADY_EXISTS(id: any): string;
    const NO_DB: string;
    const DB_NOT_READY: string;
    const NO_MATCHING_PLUGINS: string;
    const CLIENT_ID_REQUIRED: string;
    const COUNTERPARTY_REQUIRED: string;
    const NOT_ALLOWED: string;
    const NO_PAYMENT_FILE: string;
    const INVALID_DIRECTION: string;
    const COMPLETED_BY_PLUGIN_REQUIRED: string;
    const COMPLETED_BY_PLUGIN_NAME_REQUIRED: string;
    const COMPLETED_BY_PLUGIN_STATE_REQUIRED: string;
    function INVALID_PLUGIN_STATE(state: any): string;
    const COMPLETED_BY_PLUGIN_START_AT_REQUIRED: string;
}
export namespace PAYMENT_DIRECTION {
    const IN: string;
    const OUT: string;
}
import { PaymentAmount } from "./PaymentAmount";
import { PaymentState } from "./PaymentState";
export { PAYMENT_STATE, PLUGIN_STATE };
