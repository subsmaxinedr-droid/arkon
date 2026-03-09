import { Transaction } from "@scure/btc-signer/transaction.js";
/**
 * TxTreeNode is a node of the tree.
 * It contains the transaction id, the transaction and the children.
 * any TxTree can be serialized as a list of TxTreeNode.
 */
export type TxTreeNode = {
    txid: string;
    tx: string;
    children: Record<number, string>;
};
/**
 * TxTree is a graph of bitcoin transactions.
 * It is used to represent batch tree created during settlement session
 */
export declare class TxTree {
    readonly root: Transaction;
    readonly children: Map<number, TxTree>;
    constructor(root: Transaction, children?: Map<number, TxTree>);
    static create(chunks: TxTreeNode[]): TxTree;
    nbOfNodes(): number;
    validate(): void;
    leaves(): Transaction[];
    get txid(): string;
    find(txid: string): TxTree | null;
    update(txid: string, fn: (tx: Transaction) => void): void;
    iterator(): Generator<TxTree, void, unknown>;
}
