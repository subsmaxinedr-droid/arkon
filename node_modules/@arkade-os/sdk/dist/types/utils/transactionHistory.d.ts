import { ArkTransaction, VirtualCoin } from "../wallet";
type ExtendedArkTransaction = ArkTransaction & {
    tag: "offchain" | "boarding" | "exit" | "batch";
};
/**
 * Builds the transaction history by analyzing virtual coins (VTXOs), boarding transactions, and ignored commitments.
 * History is sorted from newest to oldest and is composed only of SENT and RECEIVED transactions.
 *
 * @param {VirtualCoin[]} vtxos - An array of virtual coins representing the user's transactions and balances.
 * @param {ArkTransaction[]} allBoardingTxs - An array of boarding transactions to include in the history.
 * @param {Set<string>} commitmentsToIgnore - A set of commitment IDs that should be excluded from processing.
 * @return {ExtendedArkTransaction[]} A sorted array of extended Ark transactions, representing the transaction history.
 */
export declare function buildTransactionHistory(vtxos: VirtualCoin[], allBoardingTxs: ArkTransaction[], commitmentsToIgnore: Set<string>, getTxCreatedAt?: (txid: string) => Promise<number>): Promise<ExtendedArkTransaction[]>;
export {};
