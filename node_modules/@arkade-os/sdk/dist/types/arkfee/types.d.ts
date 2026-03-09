/**
 * FeeAmount is a wrapper around a number that represents a fee amount in satoshis floating point.
 * @param value - The fee amount in floating point.
 * @method satoshis - Returns the fee amount in satoshis as a integer.
 * @example
 * const fee = new FeeAmount(1.23456789);
 * console.log(fee.value); // 1.23456789
 * console.log(fee.satoshis); // 2
 */
export declare class FeeAmount {
    readonly value: number;
    static ZERO: FeeAmount;
    constructor(value: number);
    get satoshis(): number;
    add(other: FeeAmount): FeeAmount;
}
export interface IntentFeeConfig {
    offchainInput?: string;
    onchainInput?: string;
    offchainOutput?: string;
    onchainOutput?: string;
}
export type VtxoType = "recoverable" | "vtxo" | "note";
export interface OffchainInput {
    amount: bigint;
    expiry?: Date;
    birth?: Date;
    type: VtxoType;
    weight: number;
}
export interface OnchainInput {
    amount: bigint;
}
export interface FeeOutput {
    amount: bigint;
    script: string;
}
