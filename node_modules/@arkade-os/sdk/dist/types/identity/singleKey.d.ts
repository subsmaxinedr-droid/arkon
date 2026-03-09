import { Identity, ReadonlyIdentity } from ".";
import { Transaction } from "../utils/transaction";
import { SignerSession } from "../tree/signingSession";
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
export declare class SingleKey implements Identity {
    private key;
    private constructor();
    static fromPrivateKey(privateKey: Uint8Array): SingleKey;
    static fromHex(privateKeyHex: string): SingleKey;
    static fromRandomBytes(): SingleKey;
    /**
     * Export the private key as a hex string.
     *
     * @returns The private key as a hex string
     */
    toHex(): string;
    sign(tx: Transaction, inputIndexes?: number[]): Promise<Transaction>;
    compressedPublicKey(): Promise<Uint8Array>;
    xOnlyPublicKey(): Promise<Uint8Array>;
    signerSession(): SignerSession;
    signMessage(message: Uint8Array, signatureType?: "schnorr" | "ecdsa"): Promise<Uint8Array>;
    toReadonly(): Promise<ReadonlySingleKey>;
}
export declare class ReadonlySingleKey implements ReadonlyIdentity {
    private readonly publicKey;
    constructor(publicKey: Uint8Array);
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
    static fromPublicKey(publicKey: Uint8Array): ReadonlySingleKey;
    xOnlyPublicKey(): Promise<Uint8Array>;
    compressedPublicKey(): Promise<Uint8Array>;
}
