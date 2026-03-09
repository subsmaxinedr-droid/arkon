export declare function getGlobalObject(): {
    globalObject: typeof globalThis;
};
/**
 * Opens an IndexedDB database and increments the reference count.
 * Handles global object detection and callbacks.
 *
 * @param dbName The name of the database to open.
 * @param dbVersion The database version to open.
 * @param initDatabase A function that migrates the database schema, called on `onupgradeneeded` only.
 *
 * @returns A promise that resolves to the database instance.
 */
export declare function openDatabase(dbName: string, dbVersion: number, initDatabase: (db: IDBDatabase) => void): Promise<IDBDatabase>;
/**
 * Decrements the reference count and closes the database when no references remain.
 *
 * @param dbName The name of the database to close.
 *
 * @returns True if the database was closed, false otherwise.
 */
export declare function closeDatabase(dbName: string): Promise<boolean>;
