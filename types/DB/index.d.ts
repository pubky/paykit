export class DB {
    db: {};
    ready: boolean;
    init(): Promise<void>;
    save(payment: any): Promise<void>;
    update(id: any, update: any): Promise<void>;
    delete(id: any): Promise<void>;
    get(id: any, options?: {
        removed: boolean;
    }): Promise<any>;
    getPayments(orderId: any): Promise<any>;
}
export namespace ERROR {
    const NOT_READY: string;
}
