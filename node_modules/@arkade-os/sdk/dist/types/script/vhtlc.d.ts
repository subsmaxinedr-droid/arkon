import { Bytes } from "@scure/btc-signer/utils.js";
import { RelativeTimelock } from "./tapscript";
import { TapLeafScript, VtxoScript } from "./base";
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
export declare namespace VHTLC {
    interface Options {
        sender: Bytes;
        receiver: Bytes;
        server: Bytes;
        preimageHash: Bytes;
        refundLocktime: bigint;
        unilateralClaimDelay: RelativeTimelock;
        unilateralRefundDelay: RelativeTimelock;
        unilateralRefundWithoutReceiverDelay: RelativeTimelock;
    }
    class Script extends VtxoScript {
        readonly options: Options;
        readonly claimScript: string;
        readonly refundScript: string;
        readonly refundWithoutReceiverScript: string;
        readonly unilateralClaimScript: string;
        readonly unilateralRefundScript: string;
        readonly unilateralRefundWithoutReceiverScript: string;
        constructor(options: Options);
        claim(): TapLeafScript;
        refund(): TapLeafScript;
        refundWithoutReceiver(): TapLeafScript;
        unilateralClaim(): TapLeafScript;
        unilateralRefund(): TapLeafScript;
        unilateralRefundWithoutReceiver(): TapLeafScript;
    }
}
