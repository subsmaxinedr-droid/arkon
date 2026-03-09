import { Transaction } from "@scure/btc-signer";
import { TransactionInputUpdate } from "@scure/btc-signer/psbt.js";
/**
 * ArkPsbtFieldKey is the key values for ark psbt fields.
 */
export declare enum ArkPsbtFieldKey {
    VtxoTaprootTree = "taptree",
    VtxoTreeExpiry = "expiry",
    Cosigner = "cosigner",
    ConditionWitness = "condition"
}
/**
 * ArkPsbtFieldKeyType is the type of the ark psbt field key.
 * Every ark psbt field has key type 222.
 */
export declare const ArkPsbtFieldKeyType = 222;
/**
 * ArkPsbtFieldCoder is the coder for the ark psbt fields.
 * each type has its own coder.
 */
export interface ArkPsbtFieldCoder<T> {
    key: ArkPsbtFieldKey;
    encode: (value: T) => NonNullable<TransactionInputUpdate["unknown"]>[number];
    decode: (value: NonNullable<TransactionInputUpdate["unknown"]>[number]) => T | null;
}
/**
 * setArkPsbtField appends a new unknown field to the input at inputIndex
 *
 * @example
 * ```typescript
 * setArkPsbtField(tx, 0, VtxoTaprootTree, myTaprootTree);
 * setArkPsbtField(tx, 0, VtxoTreeExpiry, myVtxoTreeExpiry);
 * ```
 */
export declare function setArkPsbtField<T>(tx: Transaction, inputIndex: number, coder: ArkPsbtFieldCoder<T>, value: T): void;
/**
 * getArkPsbtFields returns all the values of the given coder for the input at inputIndex
 * Multiple fields of the same type can exist in a single input.
 *
 * @example
 * ```typescript
 * const vtxoTaprootTreeFields = getArkPsbtFields(tx, 0, VtxoTaprootTree);
 * console.log(`input has ${vtxoTaprootTreeFields.length} vtxoTaprootTree fields`);
 */
export declare function getArkPsbtFields<T>(tx: Transaction, inputIndex: number, coder: ArkPsbtFieldCoder<T>): T[];
/**
 * VtxoTaprootTree is set to pass all spending leaves of the vtxo input
 *
 * @example
 * ```typescript
 * const vtxoTaprootTree = VtxoTaprootTree.encode(myTaprootTree);
 */
export declare const VtxoTaprootTree: ArkPsbtFieldCoder<Uint8Array>;
/**
 * ConditionWitness is set to pass the witness data used to finalize the conditionMultisigClosure
 *
 * @example
 * ```typescript
 * const conditionWitness = ConditionWitness.encode(myConditionWitness);
 */
export declare const ConditionWitness: ArkPsbtFieldCoder<Uint8Array[]>;
/**
 * CosignerPublicKey is set on every TxGraph transactions to identify the musig2 public keys
 *
 * @example
 * ```typescript
 * const cosignerPublicKey = CosignerPublicKey.encode(myCosignerPublicKey);
 */
export declare const CosignerPublicKey: ArkPsbtFieldCoder<{
    index: number;
    key: Uint8Array;
}>;
/**
 * VtxoTreeExpiry is set to pass the expiry time of the input
 *
 * @example
 * ```typescript
 * const vtxoTreeExpiry = VtxoTreeExpiry.encode(myVtxoTreeExpiry);
 */
export declare const VtxoTreeExpiry: ArkPsbtFieldCoder<{
    type: "blocks" | "seconds";
    value: bigint;
}>;
