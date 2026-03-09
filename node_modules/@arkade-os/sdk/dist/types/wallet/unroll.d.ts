import { ChainTx, IndexerProvider } from "../providers/indexer";
import { AnchorBumper } from "../utils/anchor";
import { OnchainProvider } from "../providers/onchain";
import { Outpoint } from ".";
import { Wallet } from "./wallet";
import { Transaction } from "../utils/transaction";
export declare namespace Unroll {
    enum StepType {
        UNROLL = 0,
        WAIT = 1,
        DONE = 2
    }
    /**
     * Unroll step where the transaction has to be broadcasted in a 1C1P package
     */
    type UnrollStep = {
        tx: Transaction;
    };
    /**
     * Wait step where the transaction has to be confirmed onchain
     */
    type WaitStep = {
        txid: string;
    };
    /**
     * Done step where the unrolling process is complete
     */
    type DoneStep = {
        vtxoTxid: string;
    };
    type Step = ({
        type: StepType.DONE;
    } & DoneStep) | ({
        type: StepType.UNROLL;
    } & UnrollStep) | ({
        type: StepType.WAIT;
    } & WaitStep);
    /**
     * Manages the unrolling process of a VTXO back to the Bitcoin blockchain.
     *
     * The Session class implements an async iterator that processes the unrolling steps:
     * 1. **WAIT**: Waits for a transaction to be confirmed onchain (if it's in mempool)
     * 2. **UNROLL**: Broadcasts the next transaction in the chain to the blockchain
     * 3. **DONE**: Indicates the unrolling process is complete
     *
     * The unrolling process works by traversing the transaction chain from the root (most recent)
     * to the leaf (oldest), broadcasting each transaction that isn't already onchain.
     *
     * @example
     * ```typescript
     * const session = await Unroll.Session.create(vtxoOutpoint, bumper, explorer, indexer);
     *
     * // iterate over the steps
     * for await (const doneStep of session) {
     *   switch (doneStep.type) {
     *     case Unroll.StepType.WAIT:
     *       console.log(`Transaction ${doneStep.txid} confirmed`);
     *       break;
     *     case Unroll.StepType.UNROLL:
     *       console.log(`Broadcasting transaction ${doneStep.tx.id}`);
     *       break;
     *     case Unroll.StepType.DONE:
     *       console.log(`Unrolling complete for VTXO ${doneStep.vtxoTxid}`);
     *       break;
     *   }
     * }
     * ```
     **/
    class Session implements AsyncIterable<Step> {
        readonly toUnroll: Outpoint & {
            chain: ChainTx[];
        };
        readonly bumper: AnchorBumper;
        readonly explorer: OnchainProvider;
        readonly indexer: IndexerProvider;
        constructor(toUnroll: Outpoint & {
            chain: ChainTx[];
        }, bumper: AnchorBumper, explorer: OnchainProvider, indexer: IndexerProvider);
        static create(toUnroll: Outpoint, bumper: AnchorBumper, explorer: OnchainProvider, indexer: IndexerProvider): Promise<Session>;
        /**
         * Get the next step to be executed
         * @returns The next step to be executed + the function to execute it
         */
        next(): Promise<Step & {
            do: () => Promise<void>;
        }>;
        /**
         * Iterate over the steps to be executed and execute them
         * @returns An async iterator over the executed steps
         */
        [Symbol.asyncIterator](): AsyncIterator<Step>;
    }
    /**
     * Complete the unroll of a VTXO by broadcasting the transaction that spends the CSV path.
     * @param wallet the wallet owning the VTXO(s)
     * @param vtxoTxids the txids of the VTXO(s) to complete unroll
     * @param outputAddress the address to send the unrolled funds to
     * @throws if the VTXO(s) are not fully unrolled, if the txids are not found, if the tx is not confirmed, if no exit path is found or not available
     * @returns the txid of the transaction spending the unrolled funds
     */
    function completeUnroll(wallet: Wallet, vtxoTxids: string[], outputAddress: string): Promise<string>;
}
