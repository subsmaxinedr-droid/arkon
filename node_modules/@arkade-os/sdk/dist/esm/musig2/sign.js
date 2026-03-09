import * as musig from "@scure/btc-signer/musig2.js";
import { bytesToNumberBE } from "@noble/curves/utils.js";
import { Point } from "@noble/secp256k1";
import { aggregateKeys } from './keys.js';
import { schnorr } from "@noble/curves/secp256k1.js";
// Add this error type for decode failures
export class PartialSignatureError extends Error {
    constructor(message) {
        super(message);
        this.name = "PartialSignatureError";
    }
}
// Implement a concrete class for PartialSignature
export class PartialSig {
    constructor(s, R) {
        this.s = s;
        this.R = R;
        if (s.length !== 32) {
            throw new PartialSignatureError("Invalid s length");
        }
        if (R.length !== 33) {
            throw new PartialSignatureError("Invalid R length");
        }
    }
    /**
     * Encodes the partial signature into bytes
     * Returns a 32-byte array containing just the s value
     */
    encode() {
        // Return copy of s bytes
        return new Uint8Array(this.s);
    }
    /**
     * Decodes a partial signature from bytes
     * @param bytes - 32-byte array containing s value
     */
    static decode(bytes) {
        if (bytes.length !== 32) {
            throw new PartialSignatureError("Invalid partial signature length");
        }
        // Verify s is less than curve order
        const s = bytesToNumberBE(bytes);
        if (s >= Point.CURVE().n) {
            throw new PartialSignatureError("s value overflows curve order");
        }
        // For decode we don't have R, so we'll need to compute it later
        const R = new Uint8Array(33); // Zero R for now
        return new PartialSig(bytes, R);
    }
}
/**
 * Generates a MuSig2 partial signature
 */
export function sign(secNonce, privateKey, combinedNonce, publicKeys, message, options) {
    let tweakBytes;
    if (options?.taprootTweak !== undefined) {
        const { preTweakedKey } = aggregateKeys(options?.sortKeys ? musig.sortKeys(publicKeys) : publicKeys, true);
        tweakBytes = schnorr.utils.taggedHash("TapTweak", preTweakedKey.subarray(1), options.taprootTweak);
    }
    const session = new musig.Session(combinedNonce, options?.sortKeys ? musig.sortKeys(publicKeys) : publicKeys, message, tweakBytes ? [tweakBytes] : undefined, tweakBytes ? [true] : undefined);
    const partialSig = session.sign(secNonce, privateKey);
    return PartialSig.decode(partialSig);
}
