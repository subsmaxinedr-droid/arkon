"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartialSig = exports.PartialSignatureError = void 0;
exports.sign = sign;
const musig = __importStar(require("@scure/btc-signer/musig2.js"));
const utils_js_1 = require("@noble/curves/utils.js");
const secp256k1_1 = require("@noble/secp256k1");
const keys_1 = require("./keys");
const secp256k1_js_1 = require("@noble/curves/secp256k1.js");
// Add this error type for decode failures
class PartialSignatureError extends Error {
    constructor(message) {
        super(message);
        this.name = "PartialSignatureError";
    }
}
exports.PartialSignatureError = PartialSignatureError;
// Implement a concrete class for PartialSignature
class PartialSig {
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
        const s = (0, utils_js_1.bytesToNumberBE)(bytes);
        if (s >= secp256k1_1.Point.CURVE().n) {
            throw new PartialSignatureError("s value overflows curve order");
        }
        // For decode we don't have R, so we'll need to compute it later
        const R = new Uint8Array(33); // Zero R for now
        return new PartialSig(bytes, R);
    }
}
exports.PartialSig = PartialSig;
/**
 * Generates a MuSig2 partial signature
 */
function sign(secNonce, privateKey, combinedNonce, publicKeys, message, options) {
    let tweakBytes;
    if (options?.taprootTweak !== undefined) {
        const { preTweakedKey } = (0, keys_1.aggregateKeys)(options?.sortKeys ? musig.sortKeys(publicKeys) : publicKeys, true);
        tweakBytes = secp256k1_js_1.schnorr.utils.taggedHash("TapTweak", preTweakedKey.subarray(1), options.taprootTweak);
    }
    const session = new musig.Session(combinedNonce, options?.sortKeys ? musig.sortKeys(publicKeys) : publicKeys, message, tweakBytes ? [tweakBytes] : undefined, tweakBytes ? [true] : undefined);
    const partialSig = session.sign(secNonce, privateKey);
    return PartialSig.decode(partialSig);
}
