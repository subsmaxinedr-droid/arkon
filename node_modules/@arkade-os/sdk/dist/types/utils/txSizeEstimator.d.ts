import { Network } from "../networks";
export type VSize = {
    value: bigint;
    fee(feeRate: bigint): bigint;
};
export declare class TxWeightEstimator {
    static readonly P2PKH_SCRIPT_SIG_SIZE: number;
    static readonly INPUT_SIZE: number;
    static readonly BASE_CONTROL_BLOCK_SIZE: number;
    static readonly OUTPUT_SIZE: number;
    static readonly P2WPKH_OUTPUT_SIZE: number;
    static readonly BASE_TX_SIZE: number;
    static readonly WITNESS_HEADER_SIZE = 2;
    static readonly WITNESS_SCALE_FACTOR = 4;
    static readonly P2TR_OUTPUT_SIZE: number;
    hasWitness: boolean;
    inputCount: number;
    outputCount: number;
    inputSize: number;
    inputWitnessSize: number;
    outputSize: number;
    private constructor();
    static create(): TxWeightEstimator;
    addP2AInput(): TxWeightEstimator;
    addKeySpendInput(isDefault?: boolean): TxWeightEstimator;
    addP2PKHInput(): TxWeightEstimator;
    addTapscriptInput(leafWitnessSize: number, leafScriptSize: number, leafControlBlockSize: number): TxWeightEstimator;
    addP2WPKHOutput(): TxWeightEstimator;
    addP2TROutput(): TxWeightEstimator;
    /**
     * Adds an output given a raw script.
     * Cost = 8 bytes (amount) + varint(scriptLen) + scriptLen
     */
    addOutputScript(script: Uint8Array): TxWeightEstimator;
    /**
     * Adds an output by decoding the address to get the exact script size.
     */
    addOutputAddress(address: string, network: Network): TxWeightEstimator;
    vsize(): VSize;
}
