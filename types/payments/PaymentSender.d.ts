export type PLUGIN_STATES = {
    FAILED: string;
    SUCCESS: string;
};
export type ERRORS = {
    NO_PLUGINS_AVAILABLE: string;
};
/**
 * PaymentSender - class for processing outgoing payment orders
 * @class PaymentSender
 */
export class PaymentSender {
    /**
     * Creates an instance of PaymentSender.
     * @constructor PaymentSender
     * @param {PaymentOrder} paymentOrder
     * @param {DB} db
     * @param {PluginManager} pluginManager
     * @param {Function} entryPointForPlugin - callback to be called by plugin
     */
    constructor(paymentOrder: PaymentOrder, pluginManager: PluginManager, entryPointForPlugin: Function);
    paymentOrder: PaymentOrder;
    pluginManager: PluginManager;
    entryPointForPlugin: Function;
    /**
     * Submit payment to plugin
     * @method submit
     * @returns {Promise<void>}
     * @throws {Error} - if no plugins for making payment are available
     */
    submit(): Promise<void>;
    /**
     * Update payment - forwards data to plugin
     * @method updatePayment
     * @param {Object} data
     * @returns {Promise<void>}
     */
    updatePayment(data: any): Promise<void>;
    /**
     * Get plugin currently handling payment
     * @method getCurrentPlugin
     * @param {PaymentObject} payment
     * @returns {Promise<Plugin>} plugin
     */
    getCurrentPlugin(payment: PaymentObject): Promise<Plugin>;
    /**
     * Update payment state upon request of plugin sent to PaymentManager
     * @method stateUpdateCallback
     * @param {PaymentStateUpdate} update (must contain pluginState)
     * @returns {Promise<void>}
     */
    stateUpdateCallback(update: PaymentStateUpdate): Promise<void>;
    /**
     * Handle plugin state
     * @method handlePluginState
     * @param {PaymentObject} payment
     * @returns {Promise<void>}
     */
    handlePluginState(payment: PaymentObject): Promise<void>;
    /**
     * Handle payment failure
     * @method handleFailure
     * @param {PaymentObject} payment
     * @returns {Promise<void>}
     */
    handleFailure(payment: PaymentObject): Promise<void>;
    /**
     * Handle payment success
     * @method handleSuccess
     * @param {PaymentObject} payment
     * @returns {Promise<void>}
     */
    handleSuccess(payment: PaymentObject): Promise<void>;
}
export namespace PLUGIN_STATES {
    const FAILED: string;
    const SUCCESS: string;
}
export namespace ERRORS {
    const NO_PLUGINS_AVAILABLE: string;
}
