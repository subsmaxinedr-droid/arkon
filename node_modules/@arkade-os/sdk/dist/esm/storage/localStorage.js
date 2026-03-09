/**
 * @deprecated Use repositories instead
 */
export class LocalStorageAdapter {
    getSafeLocalStorage() {
        try {
            if (typeof window === "undefined" || !window.localStorage) {
                return null;
            }
            // Test access to ensure localStorage is actually available
            window.localStorage.length;
            return window.localStorage;
        }
        catch {
            // localStorage may throw in some environments (e.g., private browsing, disabled storage)
            return null;
        }
    }
    async getItem(key) {
        const localStorage = this.getSafeLocalStorage();
        if (!localStorage) {
            throw new Error("localStorage is not available in this environment");
        }
        return localStorage.getItem(key);
    }
    async setItem(key, value) {
        const localStorage = this.getSafeLocalStorage();
        if (!localStorage) {
            throw new Error("localStorage is not available in this environment");
        }
        localStorage.setItem(key, value);
    }
    async removeItem(key) {
        const localStorage = this.getSafeLocalStorage();
        if (!localStorage) {
            throw new Error("localStorage is not available in this environment");
        }
        localStorage.removeItem(key);
    }
    async clear() {
        const localStorage = this.getSafeLocalStorage();
        if (!localStorage) {
            throw new Error("localStorage is not available in this environment");
        }
        localStorage.clear();
    }
}
