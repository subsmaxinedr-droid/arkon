"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryStorageAdapter = void 0;
/**
 * @deprecated Use repositories instead
 */
class InMemoryStorageAdapter {
    constructor() {
        this.store = new Map();
    }
    async getItem(key) {
        return this.store.get(key) ?? null;
    }
    async setItem(key, value) {
        this.store.set(key, value);
    }
    async removeItem(key) {
        this.store.delete(key);
    }
    async clear() {
        this.store.clear();
    }
}
exports.InMemoryStorageAdapter = InMemoryStorageAdapter;
