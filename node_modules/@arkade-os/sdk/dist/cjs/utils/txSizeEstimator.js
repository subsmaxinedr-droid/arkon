"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxWeightEstimator = void 0;
const btc_signer_1 = require("@scure/btc-signer");
/**
 * Calculates the byte size required to store a variable-length integer (VarInt).
 * Bitcoin uses VarInts to compact integer data (like array lengths).
 *
 * @param n - The integer value to check
 * @returns The size in bytes (1, 3, 5, or 9)
 */
const getVarIntSize = (n) => {
    if (n < 0xfd)
        return 1;
    if (n <= 0xffff)
        return 3;
    if (n <= 0xffffffff)
        return 5;
    return 9;
};
class TxWeightEstimator {
    constructor(hasWitness, inputCount, outputCount, inputSize, inputWitnessSize, outputSize) {
        this.hasWitness = hasWitness;
        this.inputCount = inputCount;
        this.outputCount = outputCount;
        this.inputSize = inputSize;
        this.inputWitnessSize = inputWitnessSize;
        this.outputSize = outputSize;
    }
    static create() {
        return new TxWeightEstimator(false, 0, 0, 0, 0, 0);
    }
    addP2AInput() {
        this.inputCount++;
        this.inputSize += TxWeightEstimator.INPUT_SIZE;
        return this;
    }
    addKeySpendInput(isDefault = true) {
        this.inputCount++;
        this.inputWitnessSize += 64 + 1 + (isDefault ? 0 : 1);
        this.inputSize += TxWeightEstimator.INPUT_SIZE;
        this.hasWitness = true;
        return this;
    }
    addP2PKHInput() {
        this.inputCount++;
        this.inputWitnessSize++;
        this.inputSize +=
            TxWeightEstimator.INPUT_SIZE +
                TxWeightEstimator.P2PKH_SCRIPT_SIG_SIZE;
        return this;
    }
    addTapscriptInput(leafWitnessSize, leafScriptSize, leafControlBlockSize) {
        const controlBlockWitnessSize = 1 +
            TxWeightEstimator.BASE_CONTROL_BLOCK_SIZE +
            1 +
            leafScriptSize +
            1 +
            leafControlBlockSize;
        this.inputCount++;
        this.inputWitnessSize += leafWitnessSize + 1 + controlBlockWitnessSize;
        this.inputSize += TxWeightEstimator.INPUT_SIZE;
        this.hasWitness = true;
        return this;
    }
    addP2WPKHOutput() {
        this.outputCount++;
        this.outputSize +=
            TxWeightEstimator.OUTPUT_SIZE +
                TxWeightEstimator.P2WPKH_OUTPUT_SIZE;
        return this;
    }
    addP2TROutput() {
        this.outputCount++;
        this.outputSize +=
            TxWeightEstimator.OUTPUT_SIZE + TxWeightEstimator.P2TR_OUTPUT_SIZE;
        return this;
    }
    /**
     * Adds an output given a raw script.
     * Cost = 8 bytes (amount) + varint(scriptLen) + scriptLen
     */
    addOutputScript(script) {
        this.outputCount++;
        this.outputSize += 8 + getVarIntSize(script.length) + script.length;
        return this;
    }
    /**
     * Adds an output by decoding the address to get the exact script size.
     */
    addOutputAddress(address, network) {
        const payment = (0, btc_signer_1.Address)(network).decode(address);
        const script = btc_signer_1.OutScript.encode(payment);
        return this.addOutputScript(script);
    }
    vsize() {
        const inputCount = getVarIntSize(this.inputCount);
        const outputCount = getVarIntSize(this.outputCount);
        // Calculate the size of the transaction without witness data
        const txSizeStripped = TxWeightEstimator.BASE_TX_SIZE +
            inputCount +
            this.inputSize +
            outputCount +
            this.outputSize;
        // Calculate the total weight
        let weight = txSizeStripped * TxWeightEstimator.WITNESS_SCALE_FACTOR;
        // Add witness data if present
        if (this.hasWitness) {
            weight +=
                TxWeightEstimator.WITNESS_HEADER_SIZE + this.inputWitnessSize;
        }
        // Convert weight to vsize (weight / 4, rounded up)
        return vsize(weight);
    }
}
exports.TxWeightEstimator = TxWeightEstimator;
TxWeightEstimator.P2PKH_SCRIPT_SIG_SIZE = 1 + 73 + 1 + 33;
TxWeightEstimator.INPUT_SIZE = 32 + 4 + 1 + 4;
TxWeightEstimator.BASE_CONTROL_BLOCK_SIZE = 1 + 32;
TxWeightEstimator.OUTPUT_SIZE = 8 + 1;
TxWeightEstimator.P2WPKH_OUTPUT_SIZE = 1 + 1 + 20;
TxWeightEstimator.BASE_TX_SIZE = 8 + 2; // Version + LockTime
TxWeightEstimator.WITNESS_HEADER_SIZE = 2; // Flag + Marker
TxWeightEstimator.WITNESS_SCALE_FACTOR = 4;
TxWeightEstimator.P2TR_OUTPUT_SIZE = 1 + 1 + 32;
const vsize = (weight) => {
    const value = BigInt(Math.ceil(weight / TxWeightEstimator.WITNESS_SCALE_FACTOR));
    return {
        value,
        fee: (feeRate) => feeRate * value,
    };
};
