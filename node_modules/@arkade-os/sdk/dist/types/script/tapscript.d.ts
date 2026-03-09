import { Bytes } from "@scure/btc-signer/utils.js";
/**
 * RelativeTimelock lets to create timelocked with CHECKSEQUENCEVERIFY script.
 *
 * @example
 * ```typescript
 * const timelock = { value: 144n, type: "blocks" }; // 1 day in blocks
 * const timelock = { value: 512n, type: "seconds" }; // 8 minutes in seconds
 * ```
 */
export type RelativeTimelock = {
    value: bigint;
    type: "seconds" | "blocks";
};
export declare enum TapscriptType {
    Multisig = "multisig",
    CSVMultisig = "csv-multisig",
    ConditionCSVMultisig = "condition-csv-multisig",
    ConditionMultisig = "condition-multisig",
    CLTVMultisig = "cltv-multisig"
}
/**
 * ArkTapscript is the base element of vtxo scripts.
 * It is used to encode and decode the different types of vtxo scripts.
 */
export interface ArkTapscript<T extends TapscriptType, Params> {
    type: T;
    params: Params;
    script: Uint8Array;
}
/**
 * decodeTapscript is a function that decodes an ark tapsript from a raw script.
 *
 * @throws {Error} if the script is not a valid ark tapscript
 * @example
 * ```typescript
 * const arkTapscript = decodeTapscript(new Uint8Array(32));
 * console.log("type:", arkTapscript.type);
 * ```
 */
export declare function decodeTapscript(script: Uint8Array): ArkTapscript<TapscriptType, any>;
/**
 * Implements a multi-signature tapscript.
 *
 * <pubkey> CHECKSIGVERIFY <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const multisigTapscript = MultisigTapscript.encode({ pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
export declare namespace MultisigTapscript {
    type Type = ArkTapscript<TapscriptType.Multisig, Params>;
    enum MultisigType {
        CHECKSIG = 0,
        CHECKSIGADD = 1
    }
    type Params = {
        pubkeys: Bytes[];
        type?: MultisigType;
    };
    function encode(params: Params): Type;
    function decode(script: Uint8Array): Type;
    function is(tapscript: ArkTapscript<any, any>): tapscript is Type;
}
/**
 * Implements a relative timelock script that requires all specified pubkeys to sign
 * after the relative timelock has expired. The timelock can be specified in blocks or seconds.
 *
 * This is the standard exit closure and it is also used for the sweep closure in vtxo trees.
 *
 * <sequence> CHECKSEQUENCEVERIFY DROP <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const csvMultisigTapscript = CSVMultisigTapscript.encode({ timelock: { type: "blocks", value: 144 }, pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
export declare namespace CSVMultisigTapscript {
    type Type = ArkTapscript<TapscriptType.CSVMultisig, Params>;
    type Params = {
        timelock: RelativeTimelock;
    } & MultisigTapscript.Params;
    function encode(params: Params): Type;
    function decode(script: Uint8Array): Type;
    function is(tapscript: ArkTapscript<any, any>): tapscript is Type;
}
/**
 * Combines a condition script with an exit closure. The resulting script requires
 * the condition to be met, followed by the standard exit closure requirements
 * (timelock and signatures).
 *
 * <conditionScript> VERIFY <sequence> CHECKSEQUENCEVERIFY DROP <pubkey> CHECKSIGVERIFY <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const conditionCSVMultisigTapscript = ConditionCSVMultisigTapscript.encode({ conditionScript: new Uint8Array(32), pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
export declare namespace ConditionCSVMultisigTapscript {
    type Type = ArkTapscript<TapscriptType.ConditionCSVMultisig, Params>;
    type Params = {
        conditionScript: Bytes;
    } & CSVMultisigTapscript.Params;
    function encode(params: Params): Type;
    function decode(script: Uint8Array): Type;
    function is(tapscript: ArkTapscript<any, any>): tapscript is Type;
}
/**
 * Combines a condition script with a forfeit closure. The resulting script requires
 * the condition to be met, followed by the standard forfeit closure requirements
 * (multi-signature).
 *
 * <conditionScript> VERIFY <pubkey> CHECKSIGVERIFY <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const conditionMultisigTapscript = ConditionMultisigTapscript.encode({ conditionScript: new Uint8Array(32), pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
export declare namespace ConditionMultisigTapscript {
    type Type = ArkTapscript<TapscriptType.ConditionMultisig, Params>;
    type Params = {
        conditionScript: Bytes;
    } & MultisigTapscript.Params;
    function encode(params: Params): Type;
    function decode(script: Uint8Array): Type;
    function is(tapscript: ArkTapscript<any, any>): tapscript is Type;
}
/**
 * Implements an absolute timelock (CLTV) script combined with a forfeit closure.
 * The script requires waiting until a specific block height/timestamp before the
 * forfeit closure conditions can be met.
 *
 * <locktime> CHECKLOCKTIMEVERIFY DROP <pubkey> CHECKSIGVERIFY <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const cltvMultisigTapscript = CLTVMultisigTapscript.encode({ absoluteTimelock: 144, pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
export declare namespace CLTVMultisigTapscript {
    type Type = ArkTapscript<TapscriptType.CLTVMultisig, Params>;
    type Params = {
        absoluteTimelock: bigint;
    } & MultisigTapscript.Params;
    function encode(params: Params): Type;
    function decode(script: Uint8Array): Type;
    function is(tapscript: ArkTapscript<any, any>): tapscript is Type;
}
