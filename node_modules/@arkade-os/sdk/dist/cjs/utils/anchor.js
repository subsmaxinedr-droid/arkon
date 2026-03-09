"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.P2A = exports.ANCHOR_PKSCRIPT = exports.ANCHOR_VALUE = void 0;
exports.findP2AOutput = findP2AOutput;
const base_1 = require("@scure/base");
exports.ANCHOR_VALUE = 0n;
exports.ANCHOR_PKSCRIPT = new Uint8Array([0x51, 0x02, 0x4e, 0x73]);
/**
 * A zero-value anchor output.
 */
exports.P2A = {
    script: exports.ANCHOR_PKSCRIPT,
    amount: exports.ANCHOR_VALUE,
};
const hexP2Ascript = base_1.hex.encode(exports.P2A.script);
/**
 * search for anchor in the given transaction.
 * @throws {Error} if the anchor is not found or has the wrong amount
 */
function findP2AOutput(tx) {
    for (let i = 0; i < tx.outputsLength; i++) {
        const output = tx.getOutput(i);
        if (output.script && base_1.hex.encode(output.script) === hexP2Ascript) {
            if (output.amount !== exports.P2A.amount) {
                throw new Error(`P2A output has wrong amount, expected ${exports.P2A.amount} got ${output.amount}`);
            }
            return {
                txid: tx.id,
                index: i,
                witnessUtxo: exports.P2A,
            };
        }
    }
    throw new Error("P2A output not found");
}
