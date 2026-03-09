import type { StorageAdapter } from "./index";
/**
 * @deprecated Use repositories instead
 * Note: This requires @react-native-async-storage/async-storage to be installed
 */
export declare class AsyncStorageAdapter implements StorageAdapter {
    private AsyncStorage;
    constructor();
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}
