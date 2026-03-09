import type { StorageAdapter } from "./index";
/**
 * @deprecated Use repositories instead
 */
export declare class IndexedDBStorageAdapter implements StorageAdapter {
    private dbName;
    private version;
    private db;
    constructor(dbName: string, version?: number);
    private getDB;
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}
