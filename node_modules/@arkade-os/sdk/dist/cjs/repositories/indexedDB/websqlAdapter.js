"use strict";
/**
 * WebSQL adapter over expo-sqlite.
 *
 * Bridges the WebSQL API surface that indexeddbshim expects to the
 * synchronous expo-sqlite driver.  Only the subset actually called by
 * the shim is implemented:
 *
 *   openDatabase(name, version, displayName, estimatedSize) → WebSQLDatabase
 *   db.transaction(cb, errCb?, successCb?)
 *   tx.executeSql(sql, args?, successCb?, errorCb?)
 *   resultSet = { insertId, rowsAffected, rows: { length, item(i) } }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSQLDatabase = exports.WebSQLTransaction = void 0;
exports.openDatabase = openDatabase;
const expo_sqlite_1 = require("expo-sqlite");
// ── Database cache ───────────────────────────────────────────────────
const dbCache = new Map();
function getSqliteDb(name) {
    let db = dbCache.get(name);
    if (db)
        return { db, created: false };
    db = (0, expo_sqlite_1.openDatabaseSync)(name);
    dbCache.set(name, db);
    return { db, created: true };
}
// ── WebSQLTransaction ────────────────────────────────────────────────
class WebSQLTransaction {
    constructor() {
        /** @internal */
        this._queue = [];
    }
    executeSql(sql, args, successCb, errorCb) {
        this._queue.push({ sql, args: args ?? [], successCb, errorCb });
    }
}
exports.WebSQLTransaction = WebSQLTransaction;
// ── Helpers ──────────────────────────────────────────────────────────
function isRead(sql) {
    const trimmed = sql.trimStart().toUpperCase();
    return trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA");
}
function buildResultSet(db, sql, args) {
    if (isRead(sql)) {
        const rows = db.getAllSync(sql, args);
        return {
            insertId: 0,
            rowsAffected: 0,
            rows: {
                length: rows.length,
                item(i) {
                    return rows[i];
                },
            },
        };
    }
    const result = db.runSync(sql, args);
    return {
        insertId: result.lastInsertRowId,
        rowsAffected: result.changes,
        rows: {
            length: 0,
            item(_i) {
                return undefined;
            },
        },
    };
}
function drainQueue(db, tx) {
    // Process until the queue is empty.  Success callbacks may enqueue
    // more statements, so we loop rather than iterate a snapshot.
    while (tx._queue.length > 0) {
        const stmt = tx._queue.shift();
        try {
            const rs = buildResultSet(db, stmt.sql, stmt.args);
            if (stmt.successCb) {
                stmt.successCb(tx, rs);
            }
        }
        catch (err) {
            const sqlError = {
                code: 0,
                message: err?.message ?? String(err),
            };
            if (stmt.errorCb) {
                const shouldContinue = stmt.errorCb(tx, sqlError);
                if (shouldContinue === true) {
                    // Error handler returned true → swallow error and continue
                    continue;
                }
            }
            // Abort the transaction
            throw err;
        }
    }
}
// ── WebSQLDatabase ───────────────────────────────────────────────────
class WebSQLDatabase {
    constructor(db, version) {
        this._db = db;
        this.version = version;
    }
    transaction(callback, errorCb, successCb) {
        // WebSQL is async/callback-based.  Schedule via macrotask so the
        // caller's subsequent code runs first (matches browser behavior).
        setTimeout(() => {
            const tx = new WebSQLTransaction();
            try {
                // Let the caller enqueue statements
                callback(tx);
                // Execute everything inside a real SQLite transaction
                this._db.withTransactionSync(() => {
                    drainQueue(this._db, tx);
                });
                if (successCb)
                    successCb();
            }
            catch (err) {
                const sqlError = {
                    code: 0,
                    message: err?.message ?? String(err),
                };
                if (errorCb) {
                    errorCb(sqlError);
                }
            }
        }, 0);
    }
    readTransaction(callback, errorCb, successCb) {
        // Reads go through the same path — SQLite handles concurrency.
        this.transaction(callback, errorCb, successCb);
    }
}
exports.WebSQLDatabase = WebSQLDatabase;
// ── openDatabase (WebSQL entry point) ────────────────────────────────
function openDatabase(name, version, _displayName, _estimatedSize, _creationCallback) {
    const { db: sqliteDb, created } = getSqliteDb(name);
    const wsdb = new WebSQLDatabase(sqliteDb, version);
    if (created && _creationCallback) {
        _creationCallback(wsdb);
    }
    return wsdb;
}
