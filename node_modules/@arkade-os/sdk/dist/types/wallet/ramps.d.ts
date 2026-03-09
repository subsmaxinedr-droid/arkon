import { ExtendedCoin, IWallet } from ".";
import { FeeInfo, SettlementEvent } from "../providers/ark";
/**
 * Ramps is a class wrapping IWallet.settle method to provide a more convenient interface for onboarding and offboarding operations.
 *
 * @example
 * ```typescript
 * const ramps = new Ramps(wallet);
 * await ramps.onboard(); // onboard all boarding utxos
 * await ramps.offboard(myOnchainAddress); // collaborative exit all vtxos to onchain address
 * ```
 */
export declare class Ramps {
    readonly wallet: IWallet;
    constructor(wallet: IWallet);
    /**
     * Onboard boarding utxos.
     *
     * @param feeInfo - The fee info to deduct from the onboard amount.
     * @param boardingUtxos - The boarding utxos to onboard. If not provided, all boarding utxos will be used.
     * @param amount - The amount to onboard. If not provided, the total amount of boarding utxos will be onboarded.
     * @param eventCallback - The callback to receive settlement events. optional.
     */
    onboard(feeInfo: FeeInfo, boardingUtxos?: ExtendedCoin[], amount?: bigint, eventCallback?: (event: SettlementEvent) => void): ReturnType<IWallet["settle"]>;
    /**
     * Offboard vtxos, or "collaborative exit" vtxos to onchain address.
     *
     * @param destinationAddress - The destination address to offboard to.
     * @param feeInfo - The fee info to deduct from the offboard amount.
     * @param amount - The amount to offboard. If not provided, the total amount of vtxos will be offboarded.
     * @param eventCallback - The callback to receive settlement events. optional.
     */
    offboard(destinationAddress: string, feeInfo: FeeInfo, amount?: bigint, eventCallback?: (event: SettlementEvent) => void): ReturnType<IWallet["settle"]>;
}
