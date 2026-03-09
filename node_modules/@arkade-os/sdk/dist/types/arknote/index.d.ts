import { Bytes } from "@scure/btc-signer/utils.js";
import { TapLeafScript, VtxoScript } from "../script/base";
import { ExtendedCoin, Status } from "../wallet";
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
export declare class ArkNote implements ExtendedCoin {
    preimage: Uint8Array;
    value: number;
    HRP: string;
    static readonly DefaultHRP = "arknote";
    static readonly PreimageLength = 32;
    static readonly ValueLength = 4;
    static readonly Length: number;
    static readonly FakeOutpointIndex = 0;
    readonly vtxoScript: VtxoScript;
    readonly txid: string;
    readonly vout = 0;
    readonly forfeitTapLeafScript: TapLeafScript;
    readonly intentTapLeafScript: TapLeafScript;
    readonly tapTree: Bytes;
    readonly status: Status;
    readonly extraWitness?: Bytes[] | undefined;
    constructor(preimage: Uint8Array, value: number, HRP?: string);
    encode(): Uint8Array;
    static decode(data: Uint8Array, hrp?: string): ArkNote;
    static fromString(noteStr: string, hrp?: string): ArkNote;
    toString(): string;
}
