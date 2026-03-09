import * as musig2 from "../musig2";
import { TxTree } from "./txTree";
export declare const ErrMissingVtxoGraph: Error;
export declare const ErrMissingAggregateKey: Error;
export type Musig2PublicNonce = Pick<musig2.Nonces, "pubNonce">;
export type TreeNonces = Map<string, Musig2PublicNonce>;
export type TreePartialSigs = Map<string, musig2.PartialSig>;
export interface SignerSession {
    getPublicKey(): Promise<Uint8Array>;
    init(tree: TxTree, scriptRoot: Uint8Array, rootInputAmount: bigint): Promise<void>;
    getNonces(): Promise<TreeNonces>;
    aggregatedNonces(txid: string, noncesByPubkey: TreeNonces): Promise<{
        hasAllNonces: boolean;
    }>;
    sign(): Promise<TreePartialSigs>;
}
export declare class TreeSignerSession implements SignerSession {
    private secretKey;
    static NOT_INITIALIZED: Error;
    private myNonces;
    private aggregateNonces;
    private graph;
    private scriptRoot;
    private rootSharedOutputAmount;
    constructor(secretKey: Uint8Array);
    static random(): TreeSignerSession;
    init(tree: TxTree, scriptRoot: Uint8Array, rootInputAmount: bigint): Promise<void>;
    getPublicKey(): Promise<Uint8Array>;
    getNonces(): Promise<TreeNonces>;
    aggregatedNonces(txid: string, noncesByPubkey: TreeNonces): Promise<{
        hasAllNonces: boolean;
    }>;
    sign(): Promise<TreePartialSigs>;
    private generateNonces;
    private signPartial;
}
export declare function validateTreeSigs(finalAggregatedKey: Uint8Array, sharedOutputAmount: bigint, vtxoTree: TxTree): Promise<void>;
