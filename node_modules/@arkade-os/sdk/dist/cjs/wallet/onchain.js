"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnchainWallet = void 0;
exports.selectCoins = selectCoins;
const btc_signer_1 = require("@scure/btc-signer");
const networks_1 = require("../networks");
const onchain_1 = require("../providers/onchain");
const anchor_1 = require("../utils/anchor");
const txSizeEstimator_1 = require("../utils/txSizeEstimator");
const transaction_1 = require("../utils/transaction");
const utils_1 = require("./utils");
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
class OnchainWallet {
    constructor(identity, network, onchainP2TR, provider) {
        this.identity = identity;
        this.network = network;
        this.onchainP2TR = onchainP2TR;
        this.provider = provider;
    }
    static async create(identity, networkName, provider) {
        const pubkey = await identity.xOnlyPublicKey();
        if (!pubkey) {
            throw new Error("Invalid configured public key");
        }
        const network = (0, networks_1.getNetwork)(networkName);
        const onchainProvider = provider || new onchain_1.EsploraProvider(onchain_1.ESPLORA_URL[networkName]);
        const onchainP2TR = (0, btc_signer_1.p2tr)(pubkey, undefined, network);
        return new OnchainWallet(identity, network, onchainP2TR, onchainProvider);
    }
    get address() {
        return this.onchainP2TR.address || "";
    }
    async getCoins() {
        return this.provider.getCoins(this.address);
    }
    async getBalance() {
        const coins = await this.getCoins();
        const onchainConfirmed = coins
            .filter((coin) => coin.status.confirmed)
            .reduce((sum, coin) => sum + coin.value, 0);
        const onchainUnconfirmed = coins
            .filter((coin) => !coin.status.confirmed)
            .reduce((sum, coin) => sum + coin.value, 0);
        const onchainTotal = onchainConfirmed + onchainUnconfirmed;
        return onchainTotal;
    }
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
    estimateFeesAndSelectCoins(coins, amount, feeRate, recipientAddress) {
        const MAX_ITERATIONS = 10;
        let fee = 0;
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            const totalNeeded = amount + fee;
            const selected = selectCoins(coins, totalNeeded);
            const estimator = txSizeEstimator_1.TxWeightEstimator.create();
            for (const _ of selected.inputs) {
                estimator.addKeySpendInput();
            }
            estimator.addOutputAddress(recipientAddress, this.network);
            if (selected.changeAmount >= BigInt(utils_1.DUST_AMOUNT)) {
                estimator.addOutputAddress(this.address, this.network);
            }
            const newFee = Number(estimator.vsize().value) * feeRate;
            const roundedNewFee = Math.ceil(newFee);
            // Prevent oscillation loops when change falls just below the dust limit.
            // If removing the change output reduces the fee below our budget,
            // we accept the valid transaction state to guarantee convergence.
            if (roundedNewFee <= fee) {
                return { ...selected, fee: roundedNewFee };
            }
            fee = roundedNewFee;
        }
        throw new Error("Fee estimation failed: could not converge");
    }
    async send(params) {
        if (params.amount <= 0) {
            throw new Error("Amount must be positive");
        }
        if (params.amount < utils_1.DUST_AMOUNT) {
            throw new Error("Amount is below dust limit");
        }
        const coins = await this.getCoins();
        let feeRate = params.feeRate;
        if (!feeRate) {
            feeRate = await this.provider.getFeeRate();
        }
        if (!feeRate || feeRate < OnchainWallet.MIN_FEE_RATE) {
            feeRate = OnchainWallet.MIN_FEE_RATE;
        }
        const { inputs, changeAmount } = this.estimateFeesAndSelectCoins(coins, params.amount, feeRate, params.address);
        if (!inputs) {
            throw new Error("Fee estimation failed");
        }
        // Create transaction
        let tx = new transaction_1.Transaction();
        // Add inputs
        for (const input of inputs) {
            tx.addInput({
                txid: input.txid,
                index: input.vout,
                witnessUtxo: {
                    script: this.onchainP2TR.script,
                    amount: BigInt(input.value),
                },
                tapInternalKey: this.onchainP2TR.tapInternalKey,
            });
        }
        // Add payment output
        tx.addOutputAddress(params.address, BigInt(params.amount), this.network);
        if (changeAmount >= BigInt(utils_1.DUST_AMOUNT)) {
            tx.addOutputAddress(this.address, changeAmount, this.network);
        }
        // Sign inputs and Finalize
        tx = await this.identity.sign(tx);
        tx.finalize();
        // Broadcast
        const txid = await this.provider.broadcastTransaction(tx.hex);
        return txid;
    }
    async bumpP2A(parent) {
        const parentVsize = parent.vsize;
        let child = new transaction_1.Transaction({
            version: 3,
            allowLegacyWitnessUtxo: true,
        });
        child.addInput((0, anchor_1.findP2AOutput)(parent)); // throws if not found
        const childVsize = txSizeEstimator_1.TxWeightEstimator.create()
            .addKeySpendInput(true)
            .addP2AInput()
            .addOutputAddress(this.address, this.network)
            .vsize().value;
        const packageVSize = parentVsize + Number(childVsize);
        let feeRate = await this.provider.getFeeRate();
        if (!feeRate || feeRate < OnchainWallet.MIN_FEE_RATE) {
            feeRate = OnchainWallet.MIN_FEE_RATE;
        }
        const fee = Math.ceil(feeRate * packageVSize);
        if (!fee) {
            throw new Error(`invalid fee, got ${fee} with vsize ${packageVSize}, feeRate ${feeRate}`);
        }
        // Select coins
        const coins = await this.getCoins();
        const selected = selectCoins(coins, fee, true);
        for (const input of selected.inputs) {
            child.addInput({
                txid: input.txid,
                index: input.vout,
                witnessUtxo: {
                    script: this.onchainP2TR.script,
                    amount: BigInt(input.value),
                },
                tapInternalKey: this.onchainP2TR.tapInternalKey,
            });
        }
        child.addOutputAddress(this.address, anchor_1.P2A.amount + selected.changeAmount, this.network);
        // Sign inputs and Finalize
        child = await this.identity.sign(child);
        for (let i = 1; i < child.inputsLength; i++) {
            child.finalizeIdx(i);
        }
        try {
            await this.provider.broadcastTransaction(parent.hex, child.hex);
        }
        catch (error) {
            console.error(error);
        }
        finally {
            return [parent.hex, child.hex];
        }
    }
}
exports.OnchainWallet = OnchainWallet;
OnchainWallet.MIN_FEE_RATE = 1; // sat/vbyte
/**
 * Select coins to reach a target amount, prioritizing those closer to expiry
 * @param coins List of coins to select from
 * @param targetAmount Target amount to reach in satoshis
 * @param forceChange If true, ensure the coin selection will require a change output
 * @returns Selected coins and change amount, or null if insufficient funds
 */
function selectCoins(coins, targetAmount, forceChange = false) {
    if (isNaN(targetAmount)) {
        throw new Error("Target amount is NaN, got " + targetAmount);
    }
    if (targetAmount < 0) {
        throw new Error("Target amount is negative, got " + targetAmount);
    }
    if (targetAmount === 0) {
        return { inputs: [], changeAmount: 0n };
    }
    // Sort coins by amount (descending)
    const sortedCoins = [...coins].sort((a, b) => b.value - a.value);
    const selectedCoins = [];
    let selectedAmount = 0;
    // Select coins until we have enough
    for (const coin of sortedCoins) {
        selectedCoins.push(coin);
        selectedAmount += coin.value;
        if (forceChange
            ? selectedAmount > targetAmount
            : selectedAmount >= targetAmount) {
            break;
        }
    }
    if (selectedAmount === targetAmount) {
        return { inputs: selectedCoins, changeAmount: 0n };
    }
    if (selectedAmount < targetAmount) {
        throw new Error("Insufficient funds");
    }
    const changeAmount = BigInt(selectedAmount - targetAmount);
    return {
        inputs: selectedCoins,
        changeAmount,
    };
}
