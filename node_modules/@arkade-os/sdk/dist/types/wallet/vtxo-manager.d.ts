import { ExtendedVirtualCoin, IWallet } from ".";
import { SettlementEvent } from "../providers/ark";
export declare const DEFAULT_THRESHOLD_MS: number;
/**
 * Configuration options for automatic VTXO renewal
 */
export interface RenewalConfig {
    /**
     * Enable automatic renewal monitoring
     * @default false
     */
    enabled?: boolean;
    /**
     * Threshold in milliseconds to use as threshold for renewal
     * E.g., 86400000 means renew when 24 hours until expiry remains
     * @default 86400000 (24 hours)
     */
    thresholdMs?: number;
}
/**
 * Default renewal configuration values
 */
export declare const DEFAULT_RENEWAL_CONFIG: Required<Omit<RenewalConfig, "enabled">>;
/**
 * Check if a VTXO is expiring soon based on threshold
 *
 * @param vtxo - The virtual coin to check
 * @param thresholdMs - Threshold in milliseconds from now
 * @returns true if VTXO expires within threshold, false otherwise
 */
export declare function isVtxoExpiringSoon(vtxo: ExtendedVirtualCoin, thresholdMs: number): boolean;
/**
 * Filter VTXOs that are expiring soon or are recoverable/subdust
 *
 * @param vtxos - Array of virtual coins to check
 * @param thresholdMs - Threshold in milliseconds from now
 * @param dustAmount - Dust threshold amount in satoshis
 * @returns Array of VTXOs expiring within threshold
 */
export declare function getExpiringAndRecoverableVtxos(vtxos: ExtendedVirtualCoin[], thresholdMs: number, dustAmount: bigint): ExtendedVirtualCoin[];
/**
 * VtxoManager is a unified class for managing VTXO lifecycle operations including
 * recovery of swept/expired VTXOs and renewal to prevent expiration.
 *
 * Key Features:
 * - **Recovery**: Reclaim swept or expired VTXOs back to the wallet
 * - **Renewal**: Refresh VTXO expiration time before they expire
 * - **Smart subdust handling**: Automatically includes subdust VTXOs when economically viable
 * - **Expiry monitoring**: Check for VTXOs that are expiring soon
 *
 * VTXOs become recoverable when:
 * - The Ark server sweeps them (virtualStatus.state === "swept") and they remain spendable
 * - They are preconfirmed subdust (to consolidate small amounts without locking liquidity on settled VTXOs)
 *
 * @example
 * ```typescript
 * // Initialize with renewal config
 * const manager = new VtxoManager(wallet, {
 *   enabled: true,
 *   thresholdMs: 86400000
 * });
 *
 * // Check recoverable balance
 * const balance = await manager.getRecoverableBalance();
 * if (balance.recoverable > 0n) {
 *   console.log(`Can recover ${balance.recoverable} sats`);
 *   const txid = await manager.recoverVtxos();
 * }
 *
 * // Check for expiring VTXOs
 * const expiring = await manager.getExpiringVtxos();
 * if (expiring.length > 0) {
 *   console.log(`${expiring.length} VTXOs expiring soon`);
 *   const txid = await manager.renewVtxos();
 * }
 * ```
 */
export declare class VtxoManager {
    readonly wallet: IWallet;
    readonly renewalConfig?: RenewalConfig | undefined;
    constructor(wallet: IWallet, renewalConfig?: RenewalConfig | undefined);
    /**
     * Recover swept/expired VTXOs by settling them back to the wallet's Ark address.
     *
     * This method:
     * 1. Fetches all VTXOs (including recoverable ones)
     * 2. Filters for swept but still spendable VTXOs and preconfirmed subdust
     * 3. Includes subdust VTXOs if the total value >= dust threshold
     * 4. Settles everything back to the wallet's Ark address
     *
     * Note: Settled VTXOs with long expiry are NOT recovered to avoid locking liquidity unnecessarily.
     * Only preconfirmed subdust is recovered to consolidate small amounts.
     *
     * @param eventCallback - Optional callback to receive settlement events
     * @returns Settlement transaction ID
     * @throws Error if no recoverable VTXOs found
     *
     * @example
     * ```typescript
     * const manager = new VtxoManager(wallet);
     *
     * // Simple recovery
     * const txid = await manager.recoverVtxos();
     *
     * // With event callback
     * const txid = await manager.recoverVtxos((event) => {
     *   console.log('Settlement event:', event.type);
     * });
     * ```
     */
    recoverVtxos(eventCallback?: (event: SettlementEvent) => void): Promise<string>;
    /**
     * Get information about recoverable balance without executing recovery.
     *
     * Useful for displaying to users before they decide to recover funds.
     *
     * @returns Object containing recoverable amounts and subdust information
     *
     * @example
     * ```typescript
     * const manager = new VtxoManager(wallet);
     * const balance = await manager.getRecoverableBalance();
     *
     * if (balance.recoverable > 0n) {
     *   console.log(`You can recover ${balance.recoverable} sats`);
     *   if (balance.includesSubdust) {
     *     console.log(`This includes ${balance.subdust} sats from subdust VTXOs`);
     *   }
     * }
     * ```
     */
    getRecoverableBalance(): Promise<{
        recoverable: bigint;
        subdust: bigint;
        includesSubdust: boolean;
        vtxoCount: number;
    }>;
    /**
     * Get VTXOs that are expiring soon based on renewal configuration
     *
     * @param thresholdMs - Optional override for threshold in milliseconds
     * @returns Array of expiring VTXOs, empty array if renewal is disabled or no VTXOs expiring
     *
     * @example
     * ```typescript
     * const manager = new VtxoManager(wallet, { enabled: true, thresholdMs: 86400000 });
     * const expiringVtxos = await manager.getExpiringVtxos();
     * if (expiringVtxos.length > 0) {
     *   console.log(`${expiringVtxos.length} VTXOs expiring soon`);
     * }
     * ```
     */
    getExpiringVtxos(thresholdMs?: number): Promise<ExtendedVirtualCoin[]>;
    /**
     * Renew expiring VTXOs by settling them back to the wallet's address
     *
     * This method collects all expiring spendable VTXOs (including recoverable ones) and settles
     * them back to the wallet, effectively refreshing their expiration time. This is the
     * primary way to prevent VTXOs from expiring.
     *
     * @param eventCallback - Optional callback for settlement events
     * @returns Settlement transaction ID
     * @throws Error if no VTXOs available to renew
     * @throws Error if total amount is below dust threshold
     *
     * @example
     * ```typescript
     * const manager = new VtxoManager(wallet);
     *
     * // Simple renewal
     * const txid = await manager.renewVtxos();
     *
     * // With event callback
     * const txid = await manager.renewVtxos((event) => {
     *   console.log('Settlement event:', event.type);
     * });
     * ```
     */
    renewVtxos(eventCallback?: (event: SettlementEvent) => void): Promise<string>;
}
