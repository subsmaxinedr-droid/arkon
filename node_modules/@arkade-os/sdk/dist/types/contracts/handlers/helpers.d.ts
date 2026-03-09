import { RelativeTimelock } from "../../script/tapscript";
import { Contract, PathContext } from "../types";
/**
 * Convert RelativeTimelock to BIP68 sequence number.
 */
export declare function timelockToSequence(timelock: RelativeTimelock): number;
/**
 * Convert BIP68 sequence number back to RelativeTimelock.
 */
export declare function sequenceToTimelock(sequence: number): RelativeTimelock;
/**
 * Resolve wallet's role from explicit role or by matching pubkey.
 */
export declare function resolveRole(contract: Contract, context: PathContext): "sender" | "receiver" | undefined;
/**
 * Check if a CSV timelock is currently satisfied for the given context/VTXO.
 */
export declare function isCsvSpendable(context: PathContext, sequence?: number): boolean;
