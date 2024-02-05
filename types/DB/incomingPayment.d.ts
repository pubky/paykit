export function createIncomingPaymentTable(db: any): Promise<any>;
export function savePayment(payment: any): {
    statement: string;
    params: {
        $id: any;
        $clientOrderId: any;
        $memo: any;
        $amount: any;
        $denomination: any;
        $currency: any;
        $expectedAmount: any;
        $expectedDenomination: any;
        $expectedCurrency: any;
        $receivedByPlugins: string;
        $internalState: any;
        $createdAt: any;
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
