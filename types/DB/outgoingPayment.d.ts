export function createOutgoingPaymentTable(db: any): Promise<any>;
export function savePayment(payment: any): {
    statement: string;
    params: {
        $id: any;
        $orderId: any;
        $clientOrderId: any;
        $counterpartyURL: any;
        $memo: any;
        $sendingPriority: string;
        $amount: any;
        $denomination: any;
        $currency: any;
        $internalState: any;
        $pendingPlugins: string;
        $triedPlugins: string;
        $currentPlugin: string;
        $completedByPlugin: string;
        $direction: any;
        $createdAt: any;
        $executeAt: any;
    };
};
export function getPayment(id: any, opts: any): {
    statement: string;
    params: {
        $id: any;
    };
};
export function updatePayment(id: any, update: any): {
    statement: string;
    params: {
        $id: any;
    };
};
export function getPayments(opts: any): {
    statement: string;
    params: {};
};
/**
 * @method deserializePayment - Deserialize a payment object
 * @param {Object} payment
 * @returns {PaymentObject|null}
 */
export function deserializePayment(payment: any): PaymentObject | null;
