"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultContractHandler = void 0;
const base_1 = require("@scure/base");
const default_1 = require("../../script/default");
const helpers_1 = require("./helpers");
/**
 * Handler for default wallet VTXOs.
 *
 * Default contracts use the standard forfeit + exit tapscript:
 * - forfeit: (Alice + Server) multisig for collaborative spending
 * - exit: (Alice) + CSV timelock for unilateral exit
 */
exports.DefaultContractHandler = {
    type: "default",
    createScript(params) {
        const typed = this.deserializeParams(params);
        return new default_1.DefaultVtxo.Script(typed);
    },
    serializeParams(params) {
        return {
            pubKey: base_1.hex.encode(params.pubKey),
            serverPubKey: base_1.hex.encode(params.serverPubKey),
            csvTimelock: (0, helpers_1.timelockToSequence)(params.csvTimelock).toString(),
        };
    },
    deserializeParams(params) {
        const csvTimelock = params.csvTimelock
            ? (0, helpers_1.sequenceToTimelock)(Number(params.csvTimelock))
            : default_1.DefaultVtxo.Script.DEFAULT_TIMELOCK;
        return {
            pubKey: base_1.hex.decode(params.pubKey),
            serverPubKey: base_1.hex.decode(params.serverPubKey),
            csvTimelock,
        };
    },
    selectPath(script, contract, context) {
        if (context.collaborative) {
            // Use forfeit path for collaborative spending
            return { leaf: script.forfeit() };
        }
        // Use exit path for unilateral exit (only if CSV is satisfied)
        const sequence = contract.params.csvTimelock
            ? Number(contract.params.csvTimelock)
            : undefined;
        if (!(0, helpers_1.isCsvSpendable)(context, sequence)) {
            return null;
        }
        return {
            leaf: script.exit(),
            sequence,
        };
    },
    getAllSpendingPaths(script, contract, context) {
        const paths = [];
        // Forfeit path available with server cooperation
        if (context.collaborative) {
            paths.push({ leaf: script.forfeit() });
        }
        // Exit path always possible (CSV checked at tx time)
        const exitPath = { leaf: script.exit() };
        if (contract.params.csvTimelock) {
            exitPath.sequence = Number(contract.params.csvTimelock);
        }
        paths.push(exitPath);
        return paths;
    },
    getSpendablePaths(script, contract, context) {
        const paths = [];
        if (context.collaborative) {
            paths.push({ leaf: script.forfeit() });
        }
        const exitSequence = contract.params.csvTimelock
            ? Number(contract.params.csvTimelock)
            : undefined;
        if ((0, helpers_1.isCsvSpendable)(context, exitSequence)) {
            const exitPath = { leaf: script.exit() };
            if (exitSequence !== undefined) {
                exitPath.sequence = exitSequence;
            }
            paths.push(exitPath);
        }
        return paths;
    },
};
