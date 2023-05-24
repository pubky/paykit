export type ORDER_STATE = {
    CREATED: string;
    INITIALIZED: string;
    PROCESSING: string;
    COMPLETED: string;
    CANCELLED: string;
};
export type ERRROS = Obejct;
/**
 * Payment Order class
 * @class PaymentOrder - This class is used to create a payments
 * @property {string} id - Order id
 * @property {string} clientOrderId - Client order id
 * @property {string} state - Order state
 * @property {number} frequency - Order frequency in seconds, 0 for one time order
 * @property {Payment[]} payments - Payments associated with this order
 * @property {PaymentAmount} amount - Payment amount
 * @property {string} counterpartyURL - Counterparty URL
 * @property {string} memo - Memo
 * @property {string} sendingPriority - Sending priority
 * @property {object} orderParams - Order params
 * @property {object} db - Database
 * @property {Date} createdAt - Order creation timestamp
 * @property {Date} firstPaymentAt - Order execution timestamp
 * @property {Date} lastPaymentAt - Last payment timestamp
 */
export class PaymentOrder {
    static generateId(): string;
    /**
     * @static find - Find order by id in db
     * @param {string} id - Order id
     * @param {DB} db - DB instance
     * @returns {Promise<PaymentOrder>}
     */
    static find(id: string, db: DB): Promise<PaymentOrder>;
    /**
     * @constructor - PaymentOrder constructor
     * @param {object} orderParams - Order params
     * @param {object} db - Database
     * @returns {PaymentOrder}
     */
    constructor(orderParams: object, db: object);
    orderParams: any;
    db: any;
    id: any;
    clientOrderId: any;
    state: any;
    createdAt: any;
    firstPaymentAt: any;
    lastPaymentAt: any;
    frequency: number;
    payments: any[];
    amount: PaymentAmount;
    counterpartyURL: any;
    memo: any;
    sendingPriority: any;
    /**
     * @method init - Initialize order and create payments
     * @returns {Promise<void>}
     */
    init(): Promise<void>;
    /**
     * Crate one time order
     * @returns {Promise<void>}
     */
    createOneTimeOrder(): Promise<void>;
    /**
     * Create recurring order
     * @returns {Promise<void>}
     */
    createRecurringOrder(): Promise<void>;
    /**
     * @method process - Process order
     * @returns {Promise<Payment>}
     */
    process(): Promise<Payment>;
    /**
     * Checks if order is ready to be processed
     * @method canProcess
     * @returns {boolean}
     */
    canProcess(): boolean;
    /**
     * @method processPayment - Process payment
     * @param {Payment} payment - Payment to process
     * @returns {Promise<Payment>}
     */
    processPayment(payment: Payment): Promise<Payment>;
    /**
     * @method getFirstOutstandingPayment - Get first outstanding payment
     * @returns {Payment}
     */
    getFirstOutstandingPayment(): Payment;
    /**
     * @method getPaymentInProgress - Get payment in progress
     * @returns {Payment}
     */
    getPaymentInProgress(): Payment;
    /**
     * @method complete - Complete order
     * @throws {Error} - If order is already completed
     * @throws {Error} - If order is cancelled
     * @returns {Promise<Payment>} - Last payment
     */
    complete(): Promise<Payment>;
    /**
     * @method cancel - Cancel order and all outstanding payments
     * @throws {Error} - If order is already completed
     * @returns {Promise<void>}
     */
    cancel(): Promise<void>;
    /**
     * @method serialize - serialize order
     * @returns {Object}
     */
    serialize(): any;
    /**
     * @method save - Save order with all corresponding payments to db
     * @returns {Promise<void>}
     */
    save(): Promise<void>;
    /**
     * @method update - Update order in db
     * @returns {Promise<void>}
     */
    update(): Promise<void>;
}
export namespace ORDER_STATE {
    const CREATED: string;
    const INITIALIZED: string;
    const PROCESSING: string;
    const COMPLETED: string;
    const CANCELLED: string;
}
export namespace ERRORS {
    const NOT_IMPLEMENTED: string;
    const ORDER_PARAMS_REQUIRED: string;
    const ORDER_AMOUNT_REQUIRED: string;
    const ORDER_COUNTERPARTY_URL_REQUIRED: string;
    const ORDER_CLIENT_ORDER_ID_REQUIRED: string;
    const ORDER_CONFIG_REQUIRED: string;
    const ORDER_CONFIG_SENDING_PARTY_REQUIRED: string;
    const DB_REQUIRED: string;
    const DB_NOT_READY: string;
    const OUTSTANDING_PAYMENTS: string;
    const ORDER_CANCELLED: string;
    const ORDER_COMPLETED: string;
    const CAN_NOT_PROCESS_ORDER: string;
    function ORDER_NOT_FOUND(id: any): string;
    function INVALID_FREQUENCY(frequency: any): string;
}
import { PaymentAmount } from "./PaymentAmount";
import { Payment } from "./Payment";
