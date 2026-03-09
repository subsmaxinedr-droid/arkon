"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadonlySingleKey = exports.SingleKey = void 0;
const utils_js_1 = require("@scure/btc-signer/utils.js");
const btc_signer_1 = require("@scure/btc-signer");
const base_1 = require("@scure/base");
const signingSession_1 = require("../tree/signingSession");
const secp256k1_1 = require("@noble/secp256k1");
const ALL_SIGHASH = Object.values(btc_signer_1.SigHash).filter((x) => typeof x === "number");
/**
 * In-memory single key implementation for Bitcoin transaction signing.
 *
 * @example
 * ```typescript
 * // Create from hex string
 * const key = SingleKey.fromHex('your_private_key_hex');
 *
 * // Create from raw bytes
 * const key = SingleKey.fromPrivateKey(privateKeyBytes);
 *
 * // Create random key
 * const randomKey = SingleKey.fromRandomBytes();
 *
 * // Sign a transaction
 * const signedTx = await key.sign(transaction);
 * ```
 */
class SingleKey {
    constructor(key) {
        this.key = key || (0, utils_js_1.randomPrivateKeyBytes)();
    }
    static fromPrivateKey(privateKey) {
        return new SingleKey(privateKey);
    }
    static fromHex(privateKeyHex) {
        return new SingleKey(base_1.hex.decode(privateKeyHex));
    }
    static fromRandomBytes() {
        return new SingleKey((0, utils_js_1.randomPrivateKeyBytes)());
    }
    /**
     * Export the private key as a hex string.
     *
     * @returns The private key as a hex string
     */
    toHex() {
        return base_1.hex.encode(this.key);
    }
    async sign(tx, inputIndexes) {
        const txCpy = tx.clone();
        if (!inputIndexes) {
            try {
                if (!txCpy.sign(this.key, ALL_SIGHASH)) {
                    throw new Error("Failed to sign transaction");
                }
            }
            catch (e) {
                if (e instanceof Error &&
                    e.message.includes("No inputs signed")) {
                    // ignore
                }
                else {
                    throw e;
                }
            }
            return txCpy;
        }
        for (const inputIndex of inputIndexes) {
            if (!txCpy.signIdx(this.key, inputIndex, ALL_SIGHASH)) {
                throw new Error(`Failed to sign input #${inputIndex}`);
            }
        }
        return txCpy;
    }
    compressedPublicKey() {
        return Promise.resolve((0, utils_js_1.pubECDSA)(this.key, true));
    }
    xOnlyPublicKey() {
        return Promise.resolve((0, utils_js_1.pubSchnorr)(this.key));
    }
    signerSession() {
        return signingSession_1.TreeSignerSession.random();
    }
    async signMessage(message, signatureType = "schnorr") {
        if (signatureType === "ecdsa")
            return (0, secp256k1_1.signAsync)(message, this.key, { prehash: false });
        return secp256k1_1.schnorr.signAsync(message, this.key);
    }
    async toReadonly() {
        return new ReadonlySingleKey(await this.compressedPublicKey());
    }
}
exports.SingleKey = SingleKey;
class ReadonlySingleKey {
    constructor(publicKey) {
        this.publicKey = publicKey;
        if (publicKey.length !== 33) {
            throw new Error("Invalid public key length");
        }
    }
    /**
     * Create a ReadonlySingleKey from a compressed public key.
     *
     * @param publicKey - 33-byte compressed public key (02/03 prefix + 32-byte x coordinate)
     * @returns A new ReadonlySingleKey instance
     * @example
     * ```typescript
     * const pubkey = new Uint8Array(33); // your compressed public key
     * const readonlyKey = ReadonlySingleKey.fromPublicKey(pubkey);
     * ```
     */
    static fromPublicKey(publicKey) {
        return new ReadonlySingleKey(publicKey);
    }
    xOnlyPublicKey() {
        return Promise.resolve(this.publicKey.slice(1));
    }
    compressedPublicKey() {
        return Promise.resolve(this.publicKey);
    }
}
exports.ReadonlySingleKey = ReadonlySingleKey;
