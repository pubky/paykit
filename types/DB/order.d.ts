export function createOrderTable(db: any): Promise<any>;
export function saveOrder(order: any): {
    statement: string;
    params: {
        $id: any;
        $clientOrderId: any;
        $state: any;
        $frequency: any;
        $amount: any;
        $denomination: any;
        $currency: any;
        $counterpartyURL: any;
        $memo: any;
        $sendingPriority: string;
        $createdAt: any;
        $firstPaymentAt: any;
        $lastPaymentAt: any;
    };
};
export function getOrder(id: any, opts: any): {
    statement: string;
    params: {
        $id: any;
    };
};
export function updateOrder(id: any, update: any): {
    statement: string;
    params: {
        $id: any;
    };
};
/**
 * @method deserializeOrder - Deserialize an order object
 * @param {Object} order
 * @returns {OrderObject|null}
 */
export function deserializeOrder(order: any): OrderObject | null;
