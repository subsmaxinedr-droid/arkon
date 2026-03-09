/**
 * MuSig2 nonce pair containing public and secret values.
 * Public nonces are two compressed points (33 bytes each).
 * Secret nonces are the corresponding private scalars plus pubkey.
 */
export type Nonces = {
    pubNonce: Uint8Array;
    secNonce: Uint8Array;
};
/**
 * Generates a pair of public and secret nonces for MuSig2 signing
 */
export declare function generateNonces(publicKey: Uint8Array): Nonces;
export declare function aggregateNonces(pubNonces: Uint8Array[]): Uint8Array;
