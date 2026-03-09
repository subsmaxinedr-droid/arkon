import * as bip68 from "bip68";
import { RawWitness, ScriptNum } from "@scure/btc-signer";
import { hex } from "@scure/base";
/**
 * ArkPsbtFieldKey is the key values for ark psbt fields.
 */
export var ArkPsbtFieldKey;
(function (ArkPsbtFieldKey) {
    ArkPsbtFieldKey["VtxoTaprootTree"] = "taptree";
    ArkPsbtFieldKey["VtxoTreeExpiry"] = "expiry";
    ArkPsbtFieldKey["Cosigner"] = "cosigner";
    ArkPsbtFieldKey["ConditionWitness"] = "condition";
})(ArkPsbtFieldKey || (ArkPsbtFieldKey = {}));
/**
 * ArkPsbtFieldKeyType is the type of the ark psbt field key.
 * Every ark psbt field has key type 222.
 */
export const ArkPsbtFieldKeyType = 222;
/**
 * setArkPsbtField appends a new unknown field to the input at inputIndex
 *
 * @example
 * ```typescript
 * setArkPsbtField(tx, 0, VtxoTaprootTree, myTaprootTree);
 * setArkPsbtField(tx, 0, VtxoTreeExpiry, myVtxoTreeExpiry);
 * ```
 */
export function setArkPsbtField(tx, inputIndex, coder, value) {
    tx.updateInput(inputIndex, {
        unknown: [
            ...(tx.getInput(inputIndex)?.unknown ?? []),
            coder.encode(value),
        ],
    });
}
/**
 * getArkPsbtFields returns all the values of the given coder for the input at inputIndex
 * Multiple fields of the same type can exist in a single input.
 *
 * @example
 * ```typescript
 * const vtxoTaprootTreeFields = getArkPsbtFields(tx, 0, VtxoTaprootTree);
 * console.log(`input has ${vtxoTaprootTreeFields.length} vtxoTaprootTree fields`);
 */
export function getArkPsbtFields(tx, inputIndex, coder) {
    const unknown = tx.getInput(inputIndex)?.unknown ?? [];
    const fields = [];
    for (const u of unknown) {
        const v = coder.decode(u);
        if (v)
            fields.push(v);
    }
    return fields;
}
/**
 * VtxoTaprootTree is set to pass all spending leaves of the vtxo input
 *
 * @example
 * ```typescript
 * const vtxoTaprootTree = VtxoTaprootTree.encode(myTaprootTree);
 */
export const VtxoTaprootTree = {
    key: ArkPsbtFieldKey.VtxoTaprootTree,
    encode: (value) => [
        {
            type: ArkPsbtFieldKeyType,
            key: encodedPsbtFieldKey[ArkPsbtFieldKey.VtxoTaprootTree],
        },
        value,
    ],
    decode: (value) => nullIfCatch(() => {
        if (!checkKeyIncludes(value[0], ArkPsbtFieldKey.VtxoTaprootTree))
            return null;
        return value[1];
    }),
};
/**
 * ConditionWitness is set to pass the witness data used to finalize the conditionMultisigClosure
 *
 * @example
 * ```typescript
 * const conditionWitness = ConditionWitness.encode(myConditionWitness);
 */
export const ConditionWitness = {
    key: ArkPsbtFieldKey.ConditionWitness,
    encode: (value) => [
        {
            type: ArkPsbtFieldKeyType,
            key: encodedPsbtFieldKey[ArkPsbtFieldKey.ConditionWitness],
        },
        RawWitness.encode(value),
    ],
    decode: (value) => nullIfCatch(() => {
        if (!checkKeyIncludes(value[0], ArkPsbtFieldKey.ConditionWitness))
            return null;
        return RawWitness.decode(value[1]);
    }),
};
/**
 * CosignerPublicKey is set on every TxGraph transactions to identify the musig2 public keys
 *
 * @example
 * ```typescript
 * const cosignerPublicKey = CosignerPublicKey.encode(myCosignerPublicKey);
 */
export const CosignerPublicKey = {
    key: ArkPsbtFieldKey.Cosigner,
    encode: (value) => [
        {
            type: ArkPsbtFieldKeyType,
            key: new Uint8Array([
                ...encodedPsbtFieldKey[ArkPsbtFieldKey.Cosigner],
                value.index,
            ]),
        },
        value.key,
    ],
    decode: (unknown) => nullIfCatch(() => {
        if (!checkKeyIncludes(unknown[0], ArkPsbtFieldKey.Cosigner))
            return null;
        return {
            index: unknown[0].key[unknown[0].key.length - 1],
            key: unknown[1],
        };
    }),
};
/**
 * VtxoTreeExpiry is set to pass the expiry time of the input
 *
 * @example
 * ```typescript
 * const vtxoTreeExpiry = VtxoTreeExpiry.encode(myVtxoTreeExpiry);
 */
export const VtxoTreeExpiry = {
    key: ArkPsbtFieldKey.VtxoTreeExpiry,
    encode: (value) => [
        {
            type: ArkPsbtFieldKeyType,
            key: encodedPsbtFieldKey[ArkPsbtFieldKey.VtxoTreeExpiry],
        },
        ScriptNum(6, true).encode(value.value === 0n ? 0n : value.value),
    ],
    decode: (unknown) => nullIfCatch(() => {
        if (!checkKeyIncludes(unknown[0], ArkPsbtFieldKey.VtxoTreeExpiry))
            return null;
        const v = ScriptNum(6, true).decode(unknown[1]);
        if (!v)
            return null;
        const { blocks, seconds } = bip68.decode(Number(v));
        return {
            type: blocks ? "blocks" : "seconds",
            value: BigInt(blocks ?? seconds ?? 0),
        };
    }),
};
const encodedPsbtFieldKey = Object.fromEntries(Object.values(ArkPsbtFieldKey).map((key) => [
    key,
    new TextEncoder().encode(key),
]));
const nullIfCatch = (fn) => {
    try {
        return fn();
    }
    catch (err) {
        return null;
    }
};
function checkKeyIncludes(key, arkPsbtFieldKey) {
    const expected = hex.encode(encodedPsbtFieldKey[arkPsbtFieldKey]);
    return hex
        .encode(new Uint8Array([key.type, ...key.key]))
        .includes(expected);
}
