import { P2TR } from "@scure/btc-signer/payment.js";
import { Coin, SendBitcoinParams } from ".";
import { Identity } from "../identity";
import { Network, NetworkName } from "../networks";
import { OnchainProvider } from "../providers/onchain";
import { AnchorBumper } from "../utils/anchor";
import { Transaction } from "../utils/transaction";
/**
 * Onchain Bitcoin wallet implementation for traditional Bitcoin transactions.
 *
 * This wallet handles regular Bitcoin transactions on the blockchain without
 * using the Ark protocol. It supports P2TR (Pay-to-Taproot) addresses and
 * provides basic Bitcoin wallet functionality.
 *
 * @example
 * ```typescript
 * const wallet = await OnchainWallet.create(identity, 'mainnet');
 * const balance = await wallet.getBalance();
 * const txid = await wallet.send({
 *   address: 'bc1...',
 *   amount: 50000
 * });
 * ```
 */
export declare class OnchainWallet implements AnchorBumper {
    private identity;
    static MIN_FEE_RATE: number;
    readonly onchainP2TR: P2TR;
    readonly provider: OnchainProvider;
    readonly network: Network;
    private constructor();
    static create(identity: Identity, networkName: NetworkName, provider?: OnchainProvider): Promise<OnchainWallet>;
    get address(): string;
    getCoins(): Promise<Coin[]>;
    getBalance(): Promise<number>;
    /**
     * Iteratively selects coins and estimates transaction fees until convergence.
     *
     * This method handles the circular dependency between coin selection and fee
     * estimation: the fee depends on transaction size, which depends on the number
     * of inputs (selected coins) and whether a change output is needed.
     *
     * The algorithm iterates up to 10 times, refining the fee estimate based on
     * the actual transaction structure. It resolves dust oscillation loops that
     * occur when the change amount hovers near the dust threshold—adding/removing
     * the change output causes the fee to fluctuate, preventing convergence.
     * When a lower fee is computed (indicating the change output was dropped),
     * the function accepts this state to guarantee termination.
     *
     * @param coins - Available coins to select from
     * @param amount - Target send amount in satoshis
     * @param feeRate - Fee rate in sat/vbyte
     * @param recipientAddress - Destination address for size estimation
     * @returns Selected inputs, change amount, and calculated fee
     * @throws Error if fee estimation fails to converge within max iterations
     */
    private estimateFeesAndSelectCoins;
    send(params: SendBitcoinParams): Promise<string>;
    bumpP2A(parent: Transaction): Promise<[string, string]>;
}
/**
 * Select coins to reach a target amount, prioritizing those closer to expiry
 * @param coins List of coins to select from
 * @param targetAmount Target amount to reach in satoshis
 * @param forceChange If true, ensure the coin selection will require a change output
 * @returns Selected coins and change amount, or null if insufficient funds
 */
export declare function selectCoins(coins: Coin[], targetAmount: number, forceChange?: boolean): {
    inputs: Coin[];
    changeAmount: bigint;
};
