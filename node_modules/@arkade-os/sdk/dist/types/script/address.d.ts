import { Bytes } from "@scure/btc-signer/utils.js";
/**
 * ArkAddress allows to create and decode bech32m encoded ark address.
 * An ark address is composed of:
 * - a human readable prefix (hrp)
 * - a version byte (1 byte)
 * - a server public key (32 bytes)
 * - a vtxo taproot public key (32 bytes)
 *
 * @example
 * ```typescript
 * const address = new ArkAddress(
 *     new Uint8Array(32), // server public key
 *     new Uint8Array(32), // vtxo taproot public key
 *     "ark"
 * );
 *
 * const encoded = address.encode();
 * console.log("address: ", encoded);
 *
 * const decoded = ArkAddress.decode(encoded);
 * ```
 */
export declare class ArkAddress {
    readonly serverPubKey: Bytes;
    readonly vtxoTaprootKey: Bytes;
    readonly hrp: string;
    readonly version: number;
    constructor(serverPubKey: Bytes, vtxoTaprootKey: Bytes, hrp: string, version?: number);
    static decode(address: string): ArkAddress;
    encode(): string;
    get pkScript(): Bytes;
    get subdustPkScript(): Bytes;
}
