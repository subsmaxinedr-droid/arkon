import { hex } from "@scure/base";
import { DefaultVtxo } from '../../script/default.js';
import { isCsvSpendable, sequenceToTimelock, timelockToSequence, } from './helpers.js';
/**
 * Handler for default wallet VTXOs.
 *
 * Default contracts use the standard forfeit + exit tapscript:
 * - forfeit: (Alice + Server) multisig for collaborative spending
 * - exit: (Alice) + CSV timelock for unilateral exit
 */
export const DefaultContractHandler = {
    type: "default",
    createScript(params) {
        const typed = this.deserializeParams(params);
        return new DefaultVtxo.Script(typed);
    },
    serializeParams(params) {
        return {
            pubKey: hex.encode(params.pubKey),
            serverPubKey: hex.encode(params.serverPubKey),
            csvTimelock: timelockToSequence(params.csvTimelock).toString(),
        };
    },
    deserializeParams(params) {
        const csvTimelock = params.csvTimelock
            ? sequenceToTimelock(Number(params.csvTimelock))
            : DefaultVtxo.Script.DEFAULT_TIMELOCK;
        return {
            pubKey: hex.decode(params.pubKey),
            serverPubKey: hex.decode(params.serverPubKey),
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
        if (!isCsvSpendable(context, sequence)) {
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
        if (isCsvSpendable(context, exitSequence)) {
            const exitPath = { leaf: script.exit() };
            if (exitSequence !== undefined) {
                exitPath.sequence = exitSequence;
            }
            paths.push(exitPath);
        }
        return paths;
    },
};
