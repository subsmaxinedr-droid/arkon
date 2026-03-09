"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VtxoTreeExpiry = exports.CosignerPublicKey = exports.ConditionWitness = exports.VtxoTaprootTree = exports.ArkPsbtFieldKeyType = exports.ArkPsbtFieldKey = void 0;
exports.setArkPsbtField = setArkPsbtField;
exports.getArkPsbtFields = getArkPsbtFields;
const bip68 = __importStar(require("bip68"));
const btc_signer_1 = require("@scure/btc-signer");
const base_1 = require("@scure/base");
/**
 * ArkPsbtFieldKey is the key values for ark psbt fields.
 */
var ArkPsbtFieldKey;
(function (ArkPsbtFieldKey) {
    ArkPsbtFieldKey["VtxoTaprootTree"] = "taptree";
    ArkPsbtFieldKey["VtxoTreeExpiry"] = "expiry";
    ArkPsbtFieldKey["Cosigner"] = "cosigner";
    ArkPsbtFieldKey["ConditionWitness"] = "condition";
})(ArkPsbtFieldKey || (exports.ArkPsbtFieldKey = ArkPsbtFieldKey = {}));
/**
 * ArkPsbtFieldKeyType is the type of the ark psbt field key.
 * Every ark psbt field has key type 222.
 */
exports.ArkPsbtFieldKeyType = 222;
/**
 * setArkPsbtField appends a new unknown field to the input at inputIndex
 *
 * @example
 * ```typescript
 * setArkPsbtField(tx, 0, VtxoTaprootTree, myTaprootTree);
 * setArkPsbtField(tx, 0, VtxoTreeExpiry, myVtxoTreeExpiry);
 * ```
 */
function setArkPsbtField(tx, inputIndex, coder, value) {
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
function getArkPsbtFields(tx, inputIndex, coder) {
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
exports.VtxoTaprootTree = {
    key: ArkPsbtFieldKey.VtxoTaprootTree,
    encode: (value) => [
        {
            type: exports.ArkPsbtFieldKeyType,
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
exports.ConditionWitness = {
    key: ArkPsbtFieldKey.ConditionWitness,
    encode: (value) => [
        {
            type: exports.ArkPsbtFieldKeyType,
            key: encodedPsbtFieldKey[ArkPsbtFieldKey.ConditionWitness],
        },
        btc_signer_1.RawWitness.encode(value),
    ],
    decode: (value) => nullIfCatch(() => {
        if (!checkKeyIncludes(value[0], ArkPsbtFieldKey.ConditionWitness))
            return null;
        return btc_signer_1.RawWitness.decode(value[1]);
    }),
};
/**
 * CosignerPublicKey is set on every TxGraph transactions to identify the musig2 public keys
 *
 * @example
 * ```typescript
 * const cosignerPublicKey = CosignerPublicKey.encode(myCosignerPublicKey);
 */
exports.CosignerPublicKey = {
    key: ArkPsbtFieldKey.Cosigner,
    encode: (value) => [
        {
            type: exports.ArkPsbtFieldKeyType,
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
exports.VtxoTreeExpiry = {
    key: ArkPsbtFieldKey.VtxoTreeExpiry,
    encode: (value) => [
        {
            type: exports.ArkPsbtFieldKeyType,
            key: encodedPsbtFieldKey[ArkPsbtFieldKey.VtxoTreeExpiry],
        },
        (0, btc_signer_1.ScriptNum)(6, true).encode(value.value === 0n ? 0n : value.value),
    ],
    decode: (unknown) => nullIfCatch(() => {
        if (!checkKeyIncludes(unknown[0], ArkPsbtFieldKey.VtxoTreeExpiry))
            return null;
        const v = (0, btc_signer_1.ScriptNum)(6, true).decode(unknown[1]);
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
    const expected = base_1.hex.encode(encodedPsbtFieldKey[arkPsbtFieldKey]);
    return base_1.hex
        .encode(new Uint8Array([key.type, ...key.key]))
        .includes(expected);
}
