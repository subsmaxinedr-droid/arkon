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
import { type SQLiteDatabase } from "expo-sqlite";
export interface SQLResultSetRowList {
    length: number;
    item(index: number): any;
}
export interface SQLResultSet {
    insertId: number;
    rowsAffected: number;
    rows: SQLResultSetRowList;
}
export interface SQLError {
    code: number;
    message: string;
}
type ExecuteSqlSuccessCb = (tx: WebSQLTransaction, resultSet: SQLResultSet) => void;
type ExecuteSqlErrorCb = (tx: WebSQLTransaction, error: SQLError) => boolean | void;
interface QueuedStatement {
    sql: string;
    args: any[];
    successCb?: ExecuteSqlSuccessCb;
    errorCb?: ExecuteSqlErrorCb;
}
export declare class WebSQLTransaction {
    /** @internal */
    _queue: QueuedStatement[];
    executeSql(sql: string, args?: any[], successCb?: ExecuteSqlSuccessCb, errorCb?: ExecuteSqlErrorCb): void;
}
export declare class WebSQLDatabase {
    /** @internal */
    _db: SQLiteDatabase;
    version: string;
    constructor(db: SQLiteDatabase, version: string);
    transaction(callback: (tx: WebSQLTransaction) => void, errorCb?: (error: SQLError) => void, successCb?: () => void): void;
    readTransaction(callback: (tx: WebSQLTransaction) => void, errorCb?: (error: SQLError) => void, successCb?: () => void): void;
}
export declare function openDatabase(name: string, version: string, _displayName: string, _estimatedSize: number, _creationCallback?: (db: WebSQLDatabase) => void): WebSQLDatabase;
export {};
