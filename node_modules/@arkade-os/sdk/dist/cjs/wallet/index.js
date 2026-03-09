"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxType = void 0;
exports.isSpendable = isSpendable;
exports.isRecoverable = isRecoverable;
exports.isExpired = isExpired;
exports.isSubdust = isSubdust;
var TxType;
(function (TxType) {
    TxType["TxSent"] = "SENT";
    TxType["TxReceived"] = "RECEIVED";
})(TxType || (exports.TxType = TxType = {}));
function isSpendable(vtxo) {
    return !vtxo.isSpent;
}
function isRecoverable(vtxo) {
    return vtxo.virtualStatus.state === "swept" && isSpendable(vtxo);
}
function isExpired(vtxo) {
    if (vtxo.virtualStatus.state === "swept")
        return true; // swept by server = expired
    const expiry = vtxo.virtualStatus.batchExpiry;
    if (!expiry)
        return false;
    // we use this as a workaround to avoid issue on regtest where expiry date is expressed in blockheight instead of timestamp
    // if expiry, as Date, is before 2025, then we admit it's too small to be a timestamp
    // TODO: API should return the expiry unit
    const expireAt = new Date(expiry);
    if (expireAt.getFullYear() < 2025)
        return false;
    return expiry <= Date.now();
}
function isSubdust(vtxo, dust) {
    return vtxo.value < dust;
}
