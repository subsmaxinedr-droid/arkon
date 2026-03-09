"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArkNote = void 0;
const base_1 = require("@scure/base");
const utils_js_1 = require("@scure/btc-signer/utils.js");
const btc_signer_1 = require("@scure/btc-signer");
const base_2 = require("../script/base");
/**
 * ArkNotes are special virtual coins in the Ark protocol that can be created
 * and spent without requiring any transactions. The server mints them, and they
 * are encoded as base58 strings with a human-readable prefix. It contains a
 * preimage and value.
 *
 * @example
 * ```typescript
 * // Create an ArkNote
 * const note = new ArkNote(preimage, 50000);
 *
 * // Encode to string
 * const noteString = note.toString();
 *
 * // Decode from string
 * const decodedNote = ArkNote.fromString(noteString);
 * ```
 */
class ArkNote {
    constructor(preimage, value, HRP = ArkNote.DefaultHRP) {
        this.preimage = preimage;
        this.value = value;
        this.HRP = HRP;
        this.vout = 0;
        const preimageHash = (0, utils_js_1.sha256)(this.preimage);
        this.vtxoScript = new base_2.VtxoScript([noteTapscript(preimageHash)]);
        const leaf = this.vtxoScript.leaves[0];
        this.txid = base_1.hex.encode(new Uint8Array(preimageHash).reverse());
        this.tapTree = this.vtxoScript.encode();
        this.forfeitTapLeafScript = leaf;
        this.intentTapLeafScript = leaf;
        this.value = value;
        this.status = { confirmed: true };
        this.extraWitness = [this.preimage];
    }
    encode() {
        const result = new Uint8Array(ArkNote.Length);
        result.set(this.preimage, 0);
        writeUInt32BE(result, this.value, this.preimage.length);
        return result;
    }
    static decode(data, hrp = ArkNote.DefaultHRP) {
        if (data.length !== ArkNote.Length) {
            throw new Error(`invalid data length: expected ${ArkNote.Length} bytes, got ${data.length}`);
        }
        const preimage = data.subarray(0, ArkNote.PreimageLength);
        const value = readUInt32BE(data, ArkNote.PreimageLength);
        return new ArkNote(preimage, value, hrp);
    }
    static fromString(noteStr, hrp = ArkNote.DefaultHRP) {
        noteStr = noteStr.trim();
        if (!noteStr.startsWith(hrp)) {
            throw new Error(`invalid human-readable part: expected ${hrp} prefix (note '${noteStr}')`);
        }
        const encoded = noteStr.slice(hrp.length);
        const decoded = base_1.base58.decode(encoded);
        if (decoded.length === 0) {
            throw new Error("failed to decode base58 string");
        }
        return ArkNote.decode(decoded, hrp);
    }
    toString() {
        return this.HRP + base_1.base58.encode(this.encode());
    }
}
exports.ArkNote = ArkNote;
ArkNote.DefaultHRP = "arknote";
ArkNote.PreimageLength = 32; // 32 bytes for the preimage
ArkNote.ValueLength = 4; // 4 bytes for the value
ArkNote.Length = ArkNote.PreimageLength + ArkNote.ValueLength;
ArkNote.FakeOutpointIndex = 0;
function writeUInt32BE(array, value, offset) {
    const view = new DataView(array.buffer, array.byteOffset + offset, 4);
    view.setUint32(0, value, false);
}
function readUInt32BE(array, offset) {
    const view = new DataView(array.buffer, array.byteOffset + offset, 4);
    return view.getUint32(0, false);
}
function noteTapscript(preimageHash) {
    return btc_signer_1.Script.encode(["SHA256", preimageHash, "EQUAL"]);
}
