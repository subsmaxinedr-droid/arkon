import type { StorageAdapter } from "./index";
/**
 * @deprecated Use repositories instead
 */
export declare class FileSystemStorageAdapter implements StorageAdapter {
    private readonly basePath;
    constructor(dirPath: string);
    private validateAndGetFilePath;
    private ensureDirectory;
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}
