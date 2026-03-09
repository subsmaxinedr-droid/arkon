"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexedDBStorageAdapter = void 0;
const db_1 = require("../repositories/indexedDB/db");
/**
 * @deprecated Use repositories instead
 */
class IndexedDBStorageAdapter {
    constructor(dbName, version = db_1.DB_VERSION) {
        this.db = null;
        this.dbName = dbName;
        this.version = version;
    }
    async getDB() {
        if (this.db)
            return this.db;
        const globalObject = typeof window === "undefined" ? self : window;
        if (!(globalObject && "indexedDB" in globalObject)) {
            throw new Error("IndexedDB is not available in this environment");
        }
        return new Promise((resolve, reject) => {
            const request = globalObject.indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains("storage")) {
                    db.createObjectStore("storage");
                }
            };
        });
    }
    async getItem(key) {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(["storage"], "readonly");
                const store = transaction.objectStore("storage");
                const request = store.get(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    resolve(request.result || null);
                };
            });
        }
        catch (error) {
            console.error(`Failed to get item for key ${key}:`, error);
            return null;
        }
    }
    async setItem(key, value) {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(["storage"], "readwrite");
                const store = transaction.objectStore("storage");
                const request = store.put(value, key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
        catch (error) {
            console.error(`Failed to set item for key ${key}:`, error);
            throw error;
        }
    }
    async removeItem(key) {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(["storage"], "readwrite");
                const store = transaction.objectStore("storage");
                const request = store.delete(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
        catch (error) {
            console.error(`Failed to remove item for key ${key}:`, error);
        }
    }
    async clear() {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(["storage"], "readwrite");
                const store = transaction.objectStore("storage");
                const request = store.clear();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
        catch (error) {
            console.error("Failed to clear storage:", error);
        }
    }
}
exports.IndexedDBStorageAdapter = IndexedDBStorageAdapter;
