import { Transaction as BtcSignerTransaction } from "@scure/btc-signer";
/**
 * Transaction is a wrapper around the @scure/btc-signer Transaction class.
 * It adds the Ark protocol specific options to the transaction.
 */
export class Transaction extends BtcSignerTransaction {
    constructor(opts) {
        super(withArkOpts(opts));
    }
    static fromPSBT(psbt_, opts) {
        return BtcSignerTransaction.fromPSBT(psbt_, withArkOpts(opts));
    }
    static fromRaw(raw, opts) {
        return BtcSignerTransaction.fromRaw(raw, withArkOpts(opts));
    }
}
Transaction.ARK_TX_OPTS = {
    allowUnknown: true,
    allowUnknownOutputs: true,
    allowUnknownInputs: true,
};
function withArkOpts(opts) {
    return { ...Transaction.ARK_TX_OPTS, ...opts };
}
