import { DefaultVtxo } from "../../script/default";
import { RelativeTimelock } from "../../script/tapscript";
import { ContractHandler } from "../types";
/**
 * Typed parameters for DefaultVtxo contracts.
 */
export interface DefaultContractParams {
    pubKey: Uint8Array;
    serverPubKey: Uint8Array;
    csvTimelock: RelativeTimelock;
}
/**
 * Handler for default wallet VTXOs.
 *
 * Default contracts use the standard forfeit + exit tapscript:
 * - forfeit: (Alice + Server) multisig for collaborative spending
 * - exit: (Alice) + CSV timelock for unilateral exit
 */
export declare const DefaultContractHandler: ContractHandler<DefaultContractParams, DefaultVtxo.Script>;
