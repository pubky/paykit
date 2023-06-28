/**
 * PaymentReceiver is a class which is responsible for making plugins to receive payments
 * @class PaymentReceiver
 */
export class PaymentReceiver {
    /**
     * @constructor PaymentReceiver
     * @param {DB} db - instance of a database
     * @param {PluginManager} pluginManager - instance of a plugin manager
     * @param {RemoteStorage} storage - instance of a local storage (e.g. HyperDrive)
     * @param {Function} notificationCallback - callback which is called when payment is received
     */
    constructor(db: DB, pluginManager: PluginManager, storage: RemoteStorage, notificationCallback: Function);
    db: DB;
    storage: RemoteStorage;
    notificationCallback: Function;
    pluginManager: PluginManager;
    ready: boolean;
    /**
     * Initialize, get ready to receive payments at returned URL
     * @param {PaymentAmount} [amount] - amount of money to receive
     * @returns {Promise<String>} - url to local drive where slashpay.json file is located
     */
    init(amount?: PaymentAmount): Promise<string>;
    /**
     * Callback which is called by plugin when payment is received
     * @param {Object} payload - payment object
     * @returns {Promise<void>}
     */
    handleNewPayment(payload: any, regenerateSlashpay?: boolean): Promise<void>;
    /**
     * @method generateSlashpayContent
     * @param {Array<String>} paymentPluginNames - list of payment plugin names
     * @param {PaymentAmount} [amount] - amount of money to receive
     * @returns {Object} - content of slashpay.json file
     */
    generateSlashpayContent(paymentPluginNames: Array<string>, amount?: PaymentAmount): any;
    /**
     * @method getListOfSupportedPaymentMethods
     * @returns {Array<String>} - list of payment plugin names
     */
    getListOfSupportedPaymentMethods(): Array<string>;
}
export namespace ERRORS {
    const PAYMENT_RECEIVER_NOT_READY: string;
}
