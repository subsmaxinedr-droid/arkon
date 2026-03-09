import { bech32m } from "@scure/base";
import { Script } from "@scure/btc-signer/script.js";
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
export class ArkAddress {
    constructor(serverPubKey, vtxoTaprootKey, hrp, version = 0) {
        this.serverPubKey = serverPubKey;
        this.vtxoTaprootKey = vtxoTaprootKey;
        this.hrp = hrp;
        this.version = version;
        if (serverPubKey.length !== 32) {
            throw new Error("Invalid server public key length, expected 32 bytes, got " +
                serverPubKey.length);
        }
        if (vtxoTaprootKey.length !== 32) {
            throw new Error("Invalid vtxo taproot public key length, expected 32 bytes, got " +
                vtxoTaprootKey.length);
        }
    }
    static decode(address) {
        const decoded = bech32m.decodeUnsafe(address, 1023);
        if (!decoded) {
            throw new Error("Invalid address");
        }
        const data = new Uint8Array(bech32m.fromWords(decoded.words));
        // First the version byte, then 32 bytes server pubkey, then 32 bytes vtxo taproot pubkey
        if (data.length !== 1 + 32 + 32) {
            throw new Error("Invalid data length, expected 65 bytes, got " + data.length);
        }
        const version = data[0];
        const serverPubKey = data.slice(1, 33);
        const vtxoTaprootPubKey = data.slice(33, 65);
        return new ArkAddress(serverPubKey, vtxoTaprootPubKey, decoded.prefix, version);
    }
    encode() {
        // Combine version byte, server pubkey, and vtxo taproot pubkey
        const data = new Uint8Array(1 + 32 + 32);
        data[0] = this.version;
        data.set(this.serverPubKey, 1);
        data.set(this.vtxoTaprootKey, 33);
        const words = bech32m.toWords(data);
        return bech32m.encode(this.hrp, words, 1023);
    }
    // pkScript is the script that should be used to send non-dust funds to the address
    get pkScript() {
        return Script.encode(["OP_1", this.vtxoTaprootKey]);
    }
    // subdustPkScript is the script that should be used to send sub-dust funds to the address
    get subdustPkScript() {
        return Script.encode(["RETURN", this.vtxoTaprootKey]);
    }
}
