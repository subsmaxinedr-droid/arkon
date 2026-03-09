import { IndexerProvider } from "../providers/indexer";
import { WalletRepository } from "../repositories/walletRepository";
import { Contract, ContractEventCallback } from "./types";
/**
 * Configuration for the ContractWatcher.
 */
export interface ContractWatcherConfig {
    /** The indexer provider to use for subscriptions and queries */
    indexerProvider: IndexerProvider;
    /** The wallet repository for VTXO persistence (optional) */
    walletRepository: WalletRepository;
    /**
     * Interval for failsafe polling (ms).
     * Polls even when subscription is active to catch missed events.
     * Default: 60000 (1 minute)
     */
    failsafePollIntervalMs?: number;
    /**
     * Initial reconnection delay (ms).
     * Uses exponential backoff on repeated failures.
     * Default: 1000 (1 second)
     */
    reconnectDelayMs?: number;
    /**
     * Maximum reconnection delay (ms).
     * Default: 30000 (30 seconds)
     */
    maxReconnectDelayMs?: number;
    /**
     * Maximum reconnection attempts before giving up.
     * Set to 0 for unlimited attempts.
     * Default: 0 (unlimited)
     */
    maxReconnectAttempts?: number;
}
/**
 * Connection state for the watcher.
 */
type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";
/**
 * Watches multiple contracts for VTXO changes with resilient connection handling.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Failsafe polling to catch missed events
 * - Polls immediately after (re)connection to sync state
 * - Graceful handling of subscription failures
 *
 * @example
 * ```typescript
 * const watcher = new ContractWatcher({
 *   indexerProvider: wallet.indexerProvider,
 * });
 *
 * // Add the wallet's default contract
 * await watcher.addContract(defaultContract);
 *
 * // Add additional contracts (swaps, etc.)
 * await watcher.addContract(swapContract);
 *
 * // Start watching for events
 * const stop = await watcher.startWatching((event) => {
 *   console.log(`${event.type} on contract ${event.contractScript}`);
 * });
 *
 * // Later: stop watching
 * stop();
 * ```
 */
export declare class ContractWatcher {
    private config;
    private contracts;
    private subscriptionId?;
    private abortController?;
    private isWatching;
    private eventCallback?;
    private connectionState;
    private reconnectAttempts;
    private reconnectTimeoutId?;
    private failsafePollIntervalId?;
    constructor(config: ContractWatcherConfig);
    /**
     * Add a contract to be watched.
     *
     * Active contracts are immediately subscribed. All contracts are polled
     * to discover any existing VTXOs (which may cause them to be watched
     * even if inactive).
     */
    addContract(contract: Contract): Promise<void>;
    /**
     * Update an existing contract.
     */
    updateContract(contract: Contract): Promise<void>;
    /**
     * Remove a contract from watching.
     */
    removeContract(contractScript: string): Promise<void>;
    /**
     * Get all in-memory contracts.
     */
    getAllContracts(): Contract[];
    /**
     * Get all active in-memory contracts.
     */
    getActiveContracts(): Contract[];
    /**
     * Get scripts that should be watched.
     *
     * Returns scripts for:
     * - All active contracts
     * - All contracts with known VTXOs (regardless of state)
     *
     * This ensures we continue monitoring contracts even after they're
     * deactivated, as long as they have unspent VTXOs.
     */
    private getScriptsToWatch;
    /**
     * Get VTXOs for contracts, grouped by contract script.
     * Uses Repository.
     */
    private getContractVtxos;
    /**
     * Start watching for VTXO events across all active contracts.
     */
    startWatching(callback: ContractEventCallback): Promise<() => void>;
    /**
     * Stop watching for events.
     */
    stopWatching(): Promise<void>;
    /**
     * Check if currently watching.
     */
    isCurrentlyWatching(): boolean;
    /**
     * Get current connection state.
     */
    getConnectionState(): ConnectionState;
    /**
     * Force a poll of all active contracts.
     * Useful for manual refresh or after app resume.
     */
    forcePoll(): Promise<void>;
    /**
     * Check for expired contracts, update their state, and emit events.
     */
    private checkExpiredContracts;
    /**
     * Connect to the subscription.
     */
    private connect;
    /**
     * Schedule a reconnection attempt.
     */
    private scheduleReconnect;
    /**
     * Start the failsafe polling interval.
     */
    private startFailsafePolling;
    /**
     * Poll all active contracts for current state.
     */
    private pollAllContracts;
    /**
     * Poll specific contracts and emit events for changes.
     */
    private pollContracts;
    private tryUpdateSubscription;
    /**
     * Update the subscription with scripts that should be watched.
     *
     * Watches both active contracts and contracts with VTXOs.
     */
    private updateSubscription;
    /**
     * Main listening loop for subscription events.
     */
    private listenLoop;
    /**
     * Handle a subscription update.
     */
    private handleSubscriptionUpdate;
    /**
     * Process VTXOs from subscription and route to correct contracts.
     * Uses the scripts from the subscription response to determine contract ownership.
     */
    private processSubscriptionVtxos;
    /**
     * Emit a VTXO event for a contract.
     */
    private emitVtxoEvent;
}
export {};
