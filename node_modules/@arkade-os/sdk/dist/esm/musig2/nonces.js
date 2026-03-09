import * as musig from "@scure/btc-signer/musig2.js";
/**
 * Generates a pair of public and secret nonces for MuSig2 signing
 */
export function generateNonces(publicKey) {
    const nonces = musig.nonceGen(publicKey);
    return { secNonce: nonces.secret, pubNonce: nonces.public };
}
export function aggregateNonces(pubNonces) {
    return musig.nonceAggregate(pubNonces);
}
