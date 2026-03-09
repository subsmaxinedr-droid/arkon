import type { StorageAdapter } from "./index";
/**
 * @deprecated Use repositories instead
 */
export declare class InMemoryStorageAdapter implements StorageAdapter {
    private store;
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}
