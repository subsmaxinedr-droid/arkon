import type { NetworkName } from "../networks";
import { Coin } from "../wallet";
/**
 * The default base URLs for esplora API providers.
 */
export declare const ESPLORA_URL: Record<NetworkName, string>;
export type ExplorerTransaction = {
    txid: string;
    vout: {
        scriptpubkey_address: string;
        value: string;
    }[];
    status: {
        confirmed: boolean;
        block_time: number;
    };
};
export interface OnchainProvider {
    getCoins(address: string): Promise<Coin[]>;
    getFeeRate(): Promise<number | undefined>;
    broadcastTransaction(...txs: string[]): Promise<string>;
    getTxOutspends(txid: string): Promise<{
        spent: boolean;
        txid: string;
    }[]>;
    getTransactions(address: string): Promise<ExplorerTransaction[]>;
    getTxStatus(txid: string): Promise<{
        confirmed: false;
    } | {
        confirmed: true;
        blockTime: number;
        blockHeight: number;
    }>;
    getChainTip(): Promise<{
        height: number;
        time: number;
        hash: string;
    }>;
    watchAddresses(addresses: string[], eventCallback: (txs: ExplorerTransaction[]) => void): Promise<() => void>;
}
/**
 * Implementation of the onchain provider interface for esplora REST API.
 * @see https://mempool.space/docs/api/rest
 * @example
 * ```typescript
 * const provider = new EsploraProvider("https://mempool.space/api");
 * const utxos = await provider.getCoins("bcrt1q679zsd45msawvr7782r0twvmukns3drlstjt77");
 * ```
 */
export declare class EsploraProvider implements OnchainProvider {
    private baseUrl;
    readonly pollingInterval: number;
    readonly forcePolling: boolean;
    constructor(baseUrl: string, opts?: {
        pollingInterval?: number;
        forcePolling?: boolean;
    });
    getCoins(address: string): Promise<Coin[]>;
    getFeeRate(): Promise<number | undefined>;
    broadcastTransaction(...txs: string[]): Promise<string>;
    getTxOutspends(txid: string): Promise<{
        spent: boolean;
        txid: string;
    }[]>;
    getTransactions(address: string): Promise<ExplorerTransaction[]>;
    getTxStatus(txid: string): Promise<{
        confirmed: false;
    } | {
        confirmed: true;
        blockTime: number;
        blockHeight: number;
    }>;
    watchAddresses(addresses: string[], callback: (txs: ExplorerTransaction[]) => void): Promise<() => void>;
    getChainTip(): Promise<{
        height: number;
        time: number;
        hash: string;
    }>;
    private broadcastPackage;
    private broadcastTx;
}
