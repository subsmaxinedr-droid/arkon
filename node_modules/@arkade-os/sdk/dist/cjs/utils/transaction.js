"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = void 0;
const btc_signer_1 = require("@scure/btc-signer");
/**
 * Transaction is a wrapper around the @scure/btc-signer Transaction class.
 * It adds the Ark protocol specific options to the transaction.
 */
class Transaction extends btc_signer_1.Transaction {
    constructor(opts) {
        super(withArkOpts(opts));
    }
    static fromPSBT(psbt_, opts) {
        return btc_signer_1.Transaction.fromPSBT(psbt_, withArkOpts(opts));
    }
    static fromRaw(raw, opts) {
        return btc_signer_1.Transaction.fromRaw(raw, withArkOpts(opts));
    }
}
exports.Transaction = Transaction;
Transaction.ARK_TX_OPTS = {
    allowUnknown: true,
    allowUnknownOutputs: true,
    allowUnknownInputs: true,
};
function withArkOpts(opts) {
    return { ...Transaction.ARK_TX_OPTS, ...opts };
}
