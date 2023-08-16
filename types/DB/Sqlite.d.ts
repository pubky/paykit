export class Sqlite {
    constructor(config: any);
    config: any;
    version: any;
    ready: boolean;
    dbPath: any;
    deleteSqlite(): Promise<any>;
    start(): Promise<any>;
    sqlite: any;
}
export namespace ERROR {
    const DB_NAME_MISSING: string;
    const DB_PATH_MISSINT: string;
    const CONFIG_MISSING: string;
    const DB_NOT_READY: string;
}
