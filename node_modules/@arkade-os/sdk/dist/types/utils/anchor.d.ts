import { Transaction } from "@scure/btc-signer";
import { TransactionInputUpdate } from "@scure/btc-signer/psbt.js";
export declare const ANCHOR_VALUE = 0n;
export declare const ANCHOR_PKSCRIPT: Uint8Array<ArrayBuffer>;
/**
 * A zero-value anchor output.
 */
export declare const P2A: {
    script: Uint8Array<ArrayBuffer>;
    amount: bigint;
};
/**
 * search for anchor in the given transaction.
 * @throws {Error} if the anchor is not found or has the wrong amount
 */
export declare function findP2AOutput(tx: Transaction): TransactionInputUpdate;
export interface AnchorBumper {
    bumpP2A(parent: Transaction): Promise<[string, string]>;
}
