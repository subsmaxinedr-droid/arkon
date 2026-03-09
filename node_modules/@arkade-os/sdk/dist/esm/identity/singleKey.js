import { pubECDSA, pubSchnorr, randomPrivateKeyBytes, } from "@scure/btc-signer/utils.js";
import { SigHash } from "@scure/btc-signer";
import { hex } from "@scure/base";
import { TreeSignerSession } from '../tree/signingSession.js';
import { schnorr, signAsync } from "@noble/secp256k1";
const ALL_SIGHASH = Object.values(SigHash).filter((x) => typeof x === "number");
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
export class SingleKey {
    constructor(key) {
        this.key = key || randomPrivateKeyBytes();
    }
    static fromPrivateKey(privateKey) {
        return new SingleKey(privateKey);
    }
    static fromHex(privateKeyHex) {
        return new SingleKey(hex.decode(privateKeyHex));
    }
    static fromRandomBytes() {
        return new SingleKey(randomPrivateKeyBytes());
    }
    /**
     * Export the private key as a hex string.
     *
     * @returns The private key as a hex string
     */
    toHex() {
        return hex.encode(this.key);
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
        return Promise.resolve(pubECDSA(this.key, true));
    }
    xOnlyPublicKey() {
        return Promise.resolve(pubSchnorr(this.key));
    }
    signerSession() {
        return TreeSignerSession.random();
    }
    async signMessage(message, signatureType = "schnorr") {
        if (signatureType === "ecdsa")
            return signAsync(message, this.key, { prehash: false });
        return schnorr.signAsync(message, this.key);
    }
    async toReadonly() {
        return new ReadonlySingleKey(await this.compressedPublicKey());
    }
}
export class ReadonlySingleKey {
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
