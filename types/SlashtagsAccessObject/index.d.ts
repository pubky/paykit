export class SlashtagsAccessObject {
    constructor(key: any, directory: any);
    key: any;
    directory: any;
    ready: boolean;
    data: {};
    init(): Promise<void>;
    read(key: any): Promise<{
        paymentEndpoints: {
            lightning: string;
            p2sh: string;
            p2tr: string;
        };
    }>;
    create(key: any, value: any): Promise<string>;
    delete(key: any): Promise<void>;
    update(key: any, value: any): Promise<void>;
}
export namespace ERROR {
    const NOT_READY: string;
}
