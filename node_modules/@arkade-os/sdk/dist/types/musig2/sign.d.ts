export declare class PartialSignatureError extends Error {
    constructor(message: string);
}
interface SignOptions {
    sortKeys?: boolean;
    taprootTweak?: Uint8Array;
}
export declare class PartialSig {
    s: Uint8Array;
    R: Uint8Array;
    constructor(s: Uint8Array, R: Uint8Array);
    /**
     * Encodes the partial signature into bytes
     * Returns a 32-byte array containing just the s value
     */
    encode(): Uint8Array;
    /**
     * Decodes a partial signature from bytes
     * @param bytes - 32-byte array containing s value
     */
    static decode(bytes: Uint8Array): PartialSig;
}
/**
 * Generates a MuSig2 partial signature
 */
export declare function sign(secNonce: Uint8Array, privateKey: Uint8Array, combinedNonce: Uint8Array, publicKeys: Uint8Array[], message: Uint8Array, options?: SignOptions): PartialSig;
export {};
