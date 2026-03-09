"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VHTLC = void 0;
const btc_signer_1 = require("@scure/btc-signer");
const tapscript_1 = require("./tapscript");
const base_1 = require("@scure/base");
const base_2 = require("./base");
/**
 * Virtual Hash Time Lock Contract (VHTLC) implementation.
 *
 * VHTLC is a contract that enables atomic swaps and conditional payments
 * in the Ark protocol. It provides multiple spending paths:
 *
 * - **claim**: Receiver can claim funds by revealing the preimage
 * - **refund**: Sender and receiver can collaboratively refund
 * - **refundWithoutReceiver**: Sender can refund after locktime expires
 * - **unilateralClaim**: Receiver can claim unilaterally after delay
 * - **unilateralRefund**: Sender and receiver can refund unilaterally after delay
 * - **unilateralRefundWithoutReceiver**: Sender can refund unilaterally after delay
 *
 * @example
 * ```typescript
 * const vhtlc = new VHTLC.Script({
 *   sender: alicePubKey,
 *   receiver: bobPubKey,
 *   server: serverPubKey,
 *   preimageHash: hash160(secret),
 *   refundLocktime: BigInt(chainTip + 10),
 *   unilateralClaimDelay: { type: 'blocks', value: 100n },
 *   unilateralRefundDelay: { type: 'blocks', value: 102n },
 *   unilateralRefundWithoutReceiverDelay: { type: 'blocks', value: 103n }
 * });
 * ```
 */
var VHTLC;
(function (VHTLC) {
    class Script extends base_2.VtxoScript {
        constructor(options) {
            validateOptions(options);
            const { sender, receiver, server, preimageHash, refundLocktime, unilateralClaimDelay, unilateralRefundDelay, unilateralRefundWithoutReceiverDelay, } = options;
            const conditionScript = preimageConditionScript(preimageHash);
            const claimScript = tapscript_1.ConditionMultisigTapscript.encode({
                conditionScript,
                pubkeys: [receiver, server],
            }).script;
            const refundScript = tapscript_1.MultisigTapscript.encode({
                pubkeys: [sender, receiver, server],
            }).script;
            const refundWithoutReceiverScript = tapscript_1.CLTVMultisigTapscript.encode({
                absoluteTimelock: refundLocktime,
                pubkeys: [sender, server],
            }).script;
            const unilateralClaimScript = tapscript_1.ConditionCSVMultisigTapscript.encode({
                conditionScript,
                timelock: unilateralClaimDelay,
                pubkeys: [receiver],
            }).script;
            const unilateralRefundScript = tapscript_1.CSVMultisigTapscript.encode({
                timelock: unilateralRefundDelay,
                pubkeys: [sender, receiver],
            }).script;
            const unilateralRefundWithoutReceiverScript = tapscript_1.CSVMultisigTapscript.encode({
                timelock: unilateralRefundWithoutReceiverDelay,
                pubkeys: [sender],
            }).script;
            super([
                claimScript,
                refundScript,
                refundWithoutReceiverScript,
                unilateralClaimScript,
                unilateralRefundScript,
                unilateralRefundWithoutReceiverScript,
            ]);
            this.options = options;
            this.claimScript = base_1.hex.encode(claimScript);
            this.refundScript = base_1.hex.encode(refundScript);
            this.refundWithoutReceiverScript = base_1.hex.encode(refundWithoutReceiverScript);
            this.unilateralClaimScript = base_1.hex.encode(unilateralClaimScript);
            this.unilateralRefundScript = base_1.hex.encode(unilateralRefundScript);
            this.unilateralRefundWithoutReceiverScript = base_1.hex.encode(unilateralRefundWithoutReceiverScript);
        }
        claim() {
            return this.findLeaf(this.claimScript);
        }
        refund() {
            return this.findLeaf(this.refundScript);
        }
        refundWithoutReceiver() {
            return this.findLeaf(this.refundWithoutReceiverScript);
        }
        unilateralClaim() {
            return this.findLeaf(this.unilateralClaimScript);
        }
        unilateralRefund() {
            return this.findLeaf(this.unilateralRefundScript);
        }
        unilateralRefundWithoutReceiver() {
            return this.findLeaf(this.unilateralRefundWithoutReceiverScript);
        }
    }
    VHTLC.Script = Script;
    function validateOptions(options) {
        const { sender, receiver, server, preimageHash, refundLocktime, unilateralClaimDelay, unilateralRefundDelay, unilateralRefundWithoutReceiverDelay, } = options;
        if (!preimageHash || preimageHash.length !== 20) {
            throw new Error("preimage hash must be 20 bytes");
        }
        if (!receiver || receiver.length !== 32) {
            throw new Error("Invalid public key length (receiver)");
        }
        if (!sender || sender.length !== 32) {
            throw new Error("Invalid public key length (sender)");
        }
        if (!server || server.length !== 32) {
            throw new Error("Invalid public key length (server)");
        }
        if (typeof refundLocktime !== "bigint" || refundLocktime <= 0n) {
            throw new Error("refund locktime must be greater than 0");
        }
        if (!unilateralClaimDelay ||
            typeof unilateralClaimDelay.value !== "bigint" ||
            unilateralClaimDelay.value <= 0n) {
            throw new Error("unilateral claim delay must greater than 0");
        }
        if (unilateralClaimDelay.type === "seconds" &&
            unilateralClaimDelay.value % 512n !== 0n) {
            throw new Error("seconds timelock must be multiple of 512");
        }
        if (unilateralClaimDelay.type === "seconds" &&
            unilateralClaimDelay.value < 512n) {
            throw new Error("seconds timelock must be greater or equal to 512");
        }
        if (!unilateralRefundDelay ||
            typeof unilateralRefundDelay.value !== "bigint" ||
            unilateralRefundDelay.value <= 0n) {
            throw new Error("unilateral refund delay must greater than 0");
        }
        if (unilateralRefundDelay.type === "seconds" &&
            unilateralRefundDelay.value % 512n !== 0n) {
            throw new Error("seconds timelock must be multiple of 512");
        }
        if (unilateralRefundDelay.type === "seconds" &&
            unilateralRefundDelay.value < 512n) {
            throw new Error("seconds timelock must be greater or equal to 512");
        }
        if (!unilateralRefundWithoutReceiverDelay ||
            typeof unilateralRefundWithoutReceiverDelay.value !== "bigint" ||
            unilateralRefundWithoutReceiverDelay.value <= 0n) {
            throw new Error("unilateral refund without receiver delay must greater than 0");
        }
        if (unilateralRefundWithoutReceiverDelay.type === "seconds" &&
            unilateralRefundWithoutReceiverDelay.value % 512n !== 0n) {
            throw new Error("seconds timelock must be multiple of 512");
        }
        if (unilateralRefundWithoutReceiverDelay.type === "seconds" &&
            unilateralRefundWithoutReceiverDelay.value < 512n) {
            throw new Error("seconds timelock must be greater or equal to 512");
        }
    }
})(VHTLC || (exports.VHTLC = VHTLC = {}));
function preimageConditionScript(preimageHash) {
    return btc_signer_1.Script.encode(["HASH160", preimageHash, "EQUAL"]);
}
