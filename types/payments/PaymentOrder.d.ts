export type ORDER_STATE = {
    CREATED: string;
    INITIALIZED: string;
    PROCESSING: string;
    COMPLETED: string;
    CANCELLED: string;
};
export type ERRROS = Obejct;
export class PaymentOrder {
    static generateId(): any;
    /**
     * @method validateInput - Validate order params
     * @param {object} orderParams - Order params
     * @returns {void}
     * @throws {Error} - Throws error if order params are invalid
     */
    static validateInput(orderParams: object): void;
    /**
     * @method validateFrequency - Validate order frequency
     * @param {object} orderParams - Order params
     * @returns {void}
     * @throws {Error} - Throws error if order frequency is invalid
     */
    static validateFrequency(orderParams: object): void;
    /**
     * @method validateTimestamps - Validate order timestamps
     * @param {object} orderParams - Order params
     * @returns {void}
     * @throws {Error} - Throws error if order timestamps are invalid
     */
    static validateTimestamps(orderParams: object): void;
    static validateTimestamp(orderParams: any, timestampName: any): void;
    /**
     * @static find - Find order by id in db
     * @param {string} id - Order id
     * @param {DB} db - DB instance
     * @param {slashtags} slashtags - Slashtags instance
     * @returns {Promise<PaymentOrder>}
     */
    static find(id: string, db: DB, slashtags: any): Promise<PaymentOrder>;
    /**
     * @constructor - PaymentOrder constructor
     * @param {object} orderParams - Order params
     * @param {object} db - Database
     * @returns {PaymentOrder}
     */
    constructor(orderParams: object, db: object, slashtags: any);
    orderParams: any;
    db: any;
    slashtags: any;
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
    logger: {
        debug: (msg: any) => void;
        info: (msg: any) => void;
    };
    /**
     * @method init - Initialize order and create payments
     * @returns {Promise<void>}
     */
    init(): Promise<void>;
    /**
     * Create recurring order
     * @returns {void}
     */
    createPaymentForRecurringOrder(): void;
    /**
     * Create payments
     * @param {number} counter - Number of payments to create
     * @returns {void}
     */
    createPaymentObjects(counter: number): void;
    /**
     * @method process - Process order
     * @returns {Promise<PaymentObject>}
     */
    process(): Promise<PaymentObject>;
    /**
     * Checks if order is ready to be processed
     * @method canProcess
     * @returns {boolean}
     */
    canProcess(): boolean;
    /**
     * @method processPayment - Process payment
     * @param {PaymentObject} payment - Payment to process
     * @returns {Promise<PaymentObject>}
     */
    processPayment(payment: PaymentObject): Promise<PaymentObject>;
    /**
     * @method getFirstOutstandingPayment - Get first outstanding payment
     * @returns {PaymentObject}
     */
    getFirstOutstandingPayment(): PaymentObject;
    /**
     * @method getPaymentInProgress - Get payment in progress
     * @returns {PaymentObject}
     */
    getPaymentInProgress(): PaymentObject;
    /**
     * @method complete - Complete order
     * @throws {Error} - If order is already completed
     * @throws {Error} - If order is cancelled
     * @returns {Promise<PaymentObject>} - Last payment
     */
    complete(): Promise<PaymentObject>;
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
     * @method save - Save order with all corresponding payments to db, also used to add new payments to existing order
     * @returns {Promise<void>}
     */
    save(): Promise<void>;
    /**
     * @method update - Update order in db if persist is true, order will be saved to db,
     * if persist is false, it will return { statement,  params }
     * @returns {Promise<Database| { statement: string, params: object }>}
     */
    update(persist?: boolean): Promise<Database | {
        statement: string;
        params: object;
    }>;
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
    function INVALID_TIMESTAMP(tsName: any, value: any): string;
}
import { PaymentAmount } from "./PaymentAmount";
import { PaymentObject } from "./PaymentObject";
