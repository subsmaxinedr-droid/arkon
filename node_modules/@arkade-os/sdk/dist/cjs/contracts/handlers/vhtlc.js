"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VHTLCContractHandler = void 0;
const base_1 = require("@scure/base");
const vhtlc_1 = require("../../script/vhtlc");
const helpers_1 = require("./helpers");
/**
 * Handler for Virtual Hash Time Lock Contract (VHTLC).
 *
 * VHTLC supports multiple spending paths:
 *
 * Collaborative paths (with server):
 * - claim: Receiver + Server with preimage
 * - refund: Sender + Receiver + Server
 * - refundWithoutReceiver: Sender + Server after CLTV locktime
 *
 * Unilateral paths (without server):
 * - unilateralClaim: Receiver with preimage after CSV delay
 * - unilateralRefund: Sender + Receiver after CSV delay
 * - unilateralRefundWithoutReceiver: Sender after CSV delay
 */
exports.VHTLCContractHandler = {
    type: "vhtlc",
    createScript(params) {
        const typed = this.deserializeParams(params);
        return new vhtlc_1.VHTLC.Script(typed);
    },
    serializeParams(params) {
        return {
            sender: base_1.hex.encode(params.sender),
            receiver: base_1.hex.encode(params.receiver),
            server: base_1.hex.encode(params.server),
            hash: base_1.hex.encode(params.preimageHash),
            refundLocktime: params.refundLocktime.toString(),
            claimDelay: (0, helpers_1.timelockToSequence)(params.unilateralClaimDelay).toString(),
            refundDelay: (0, helpers_1.timelockToSequence)(params.unilateralRefundDelay).toString(),
            refundNoReceiverDelay: (0, helpers_1.timelockToSequence)(params.unilateralRefundWithoutReceiverDelay).toString(),
        };
    },
    deserializeParams(params) {
        return {
            sender: base_1.hex.decode(params.sender),
            receiver: base_1.hex.decode(params.receiver),
            server: base_1.hex.decode(params.server),
            preimageHash: base_1.hex.decode(params.hash),
            refundLocktime: BigInt(params.refundLocktime),
            unilateralClaimDelay: (0, helpers_1.sequenceToTimelock)(Number(params.claimDelay)),
            unilateralRefundDelay: (0, helpers_1.sequenceToTimelock)(Number(params.refundDelay)),
            unilateralRefundWithoutReceiverDelay: (0, helpers_1.sequenceToTimelock)(Number(params.refundNoReceiverDelay)),
        };
    },
    /**
     * Select spending path based on context.
     *
     * Role is determined from `context.role` or by matching `context.walletPubKey`
     * against sender/receiver in contract params.
     */
    selectPath(script, contract, context) {
        const role = (0, helpers_1.resolveRole)(contract, context);
        const preimage = contract.params?.preimage;
        const refundLocktime = BigInt(contract.params.refundLocktime);
        const currentTimeSec = Math.floor(context.currentTime / 1000);
        if (!role) {
            return null;
        }
        if (context.collaborative) {
            if (role === "receiver" && preimage) {
                return {
                    leaf: script.claim(),
                    extraWitness: [base_1.hex.decode(preimage)],
                };
            }
            if (role === "sender" && BigInt(currentTimeSec) >= refundLocktime) {
                return {
                    leaf: script.refundWithoutReceiver(),
                };
            }
            return null;
        }
        // Unilateral paths
        if (role === "receiver" && preimage) {
            const sequence = Number(contract.params.claimDelay);
            if (!(0, helpers_1.isCsvSpendable)(context, sequence))
                return null;
            return {
                leaf: script.unilateralClaim(),
                extraWitness: [base_1.hex.decode(preimage)],
                sequence,
            };
        }
        if (role === "sender") {
            const sequence = Number(contract.params.refundNoReceiverDelay);
            if (!(0, helpers_1.isCsvSpendable)(context, sequence))
                return null;
            return {
                leaf: script.unilateralRefundWithoutReceiver(),
                sequence,
            };
        }
        return null;
    },
    /**
     * Get all possible spending paths (no timelock checks).
     *
     * Role is determined from `context.role` or by matching `context.walletPubKey`
     * against sender/receiver in contract params.
     */
    getAllSpendingPaths(script, contract, context) {
        const role = (0, helpers_1.resolveRole)(contract, context);
        const paths = [];
        if (!role) {
            return paths;
        }
        const preimage = contract.params?.preimage;
        if (context.collaborative) {
            // Collaborative paths (no timelock checks)
            if (role === "receiver" && preimage) {
                paths.push({
                    leaf: script.claim(),
                    extraWitness: [base_1.hex.decode(preimage)],
                });
            }
            if (role === "sender") {
                paths.push({
                    leaf: script.refundWithoutReceiver(),
                });
            }
        }
        else {
            // Unilateral paths (no timelock checks)
            if (role === "receiver" && preimage) {
                const sequence = Number(contract.params.claimDelay);
                paths.push({
                    leaf: script.unilateralClaim(),
                    extraWitness: [base_1.hex.decode(preimage)],
                    sequence,
                });
            }
            if (role === "sender") {
                const sequence = Number(contract.params.refundNoReceiverDelay);
                paths.push({
                    leaf: script.unilateralRefundWithoutReceiver(),
                    sequence,
                });
            }
        }
        return paths;
    },
    getSpendablePaths(script, contract, context) {
        const role = (0, helpers_1.resolveRole)(contract, context);
        const paths = [];
        if (!role) {
            return paths;
        }
        const preimage = contract.params?.preimage;
        const refundLocktime = BigInt(contract.params.refundLocktime);
        const currentTimeSec = Math.floor(context.currentTime / 1000);
        if (context.collaborative) {
            if (role === "receiver" && preimage) {
                paths.push({
                    leaf: script.claim(),
                    extraWitness: [base_1.hex.decode(preimage)],
                });
            }
            if (role === "sender" && BigInt(currentTimeSec) >= refundLocktime) {
                paths.push({
                    leaf: script.refundWithoutReceiver(),
                });
            }
            return paths;
        }
        if (role === "receiver" && preimage) {
            const sequence = Number(contract.params.claimDelay);
            if ((0, helpers_1.isCsvSpendable)(context, sequence)) {
                paths.push({
                    leaf: script.unilateralClaim(),
                    extraWitness: [base_1.hex.decode(preimage)],
                    sequence,
                });
            }
        }
        if (role === "sender") {
            const sequence = Number(contract.params.refundNoReceiverDelay);
            if ((0, helpers_1.isCsvSpendable)(context, sequence)) {
                paths.push({
                    leaf: script.unilateralRefundWithoutReceiver(),
                    sequence,
                });
            }
        }
        return paths;
    },
};
