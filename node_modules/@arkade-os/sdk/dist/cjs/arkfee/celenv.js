"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentOnchainInputEnv = exports.IntentOffchainInputEnv = exports.IntentOutputEnv = exports.OutputScriptVariableName = exports.InputTypeVariableName = exports.WeightVariableName = exports.BirthVariableName = exports.ExpiryVariableName = exports.AmountVariableName = void 0;
const cel_js_1 = require("@marcbachmann/cel-js");
/**
 * Variable names used in CEL expressions
 */
exports.AmountVariableName = "amount";
exports.ExpiryVariableName = "expiry";
exports.BirthVariableName = "birth";
exports.WeightVariableName = "weight";
exports.InputTypeVariableName = "inputType";
exports.OutputScriptVariableName = "script";
const nowFunction = {
    signature: "now(): double",
    implementation: () => Math.floor(Date.now() / 1000),
};
/**
 * IntentOutputEnv is the CEL environment for output fee calculation
 * Variables: amount, script
 */
exports.IntentOutputEnv = new cel_js_1.Environment()
    .registerVariable(exports.AmountVariableName, "double")
    .registerVariable(exports.OutputScriptVariableName, "string")
    .registerFunction(nowFunction.signature, nowFunction.implementation);
/**
 * IntentOffchainInputEnv is the CEL environment for offchain input fee calculation
 * Variables: amount, expiry, birth, weight, inputType
 */
exports.IntentOffchainInputEnv = new cel_js_1.Environment()
    .registerVariable(exports.AmountVariableName, "double")
    .registerVariable(exports.ExpiryVariableName, "double")
    .registerVariable(exports.BirthVariableName, "double")
    .registerVariable(exports.WeightVariableName, "double")
    .registerVariable(exports.InputTypeVariableName, "string")
    .registerFunction(nowFunction.signature, nowFunction.implementation);
/**
 * IntentOnchainInputEnv is the CEL environment for onchain input fee calculation
 * Variables: amount
 */
exports.IntentOnchainInputEnv = new cel_js_1.Environment()
    .registerVariable(exports.AmountVariableName, "double")
    .registerFunction(nowFunction.signature, nowFunction.implementation);
