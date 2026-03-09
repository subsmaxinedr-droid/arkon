import { IntentFeeConfig, OffchainInput, OnchainInput, FeeOutput, FeeAmount } from "./types.js";
/**
 * Estimator evaluates CEL expressions to calculate fees for Ark intents
 */
export declare class Estimator {
    readonly config: IntentFeeConfig;
    private intentOffchainInput?;
    private intentOnchainInput?;
    private intentOffchainOutput?;
    private intentOnchainOutput?;
    /**
     * Creates a new Estimator with the given config
     * @param config - Configuration containing CEL programs for fee calculation
     */
    constructor(config: IntentFeeConfig);
    /**
     * Evaluates the fee for a given vtxo input
     * @param input - The offchain input to evaluate
     * @returns The fee amount for this input
     */
    evalOffchainInput(input: OffchainInput): FeeAmount;
    /**
     * Evaluates the fee for a given boarding input
     * @param input - The onchain input to evaluate
     * @returns The fee amount for this input
     */
    evalOnchainInput(input: OnchainInput): FeeAmount;
    /**
     * Evaluates the fee for a given vtxo output
     * @param output - The output to evaluate
     * @returns The fee amount for this output
     */
    evalOffchainOutput(output: FeeOutput): FeeAmount;
    /**
     * Evaluates the fee for a given collaborative exit output
     * @param output - The output to evaluate
     * @returns The fee amount for this output
     */
    evalOnchainOutput(output: FeeOutput): FeeAmount;
    /**
     * Evaluates the fee for a given set of inputs and outputs
     * @param offchainInputs - Array of offchain inputs to evaluate
     * @param onchainInputs - Array of onchain inputs to evaluate
     * @param offchainOutputs - Array of offchain outputs to evaluate
     * @param onchainOutputs - Array of onchain outputs to evaluate
     * @returns The total fee amount
     */
    eval(offchainInputs: OffchainInput[], onchainInputs: OnchainInput[], offchainOutputs: FeeOutput[], onchainOutputs: FeeOutput[]): FeeAmount;
}
