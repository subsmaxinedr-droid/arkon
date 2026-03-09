import { Environment } from "@marcbachmann/cel-js";
/**
 * Variable names used in CEL expressions
 */
export declare const AmountVariableName = "amount";
export declare const ExpiryVariableName = "expiry";
export declare const BirthVariableName = "birth";
export declare const WeightVariableName = "weight";
export declare const InputTypeVariableName = "inputType";
export declare const OutputScriptVariableName = "script";
/**
 * IntentOutputEnv is the CEL environment for output fee calculation
 * Variables: amount, script
 */
export declare const IntentOutputEnv: Environment;
/**
 * IntentOffchainInputEnv is the CEL environment for offchain input fee calculation
 * Variables: amount, expiry, birth, weight, inputType
 */
export declare const IntentOffchainInputEnv: Environment;
/**
 * IntentOnchainInputEnv is the CEL environment for onchain input fee calculation
 * Variables: amount
 */
export declare const IntentOnchainInputEnv: Environment;
