interface KeyAggOptions {
    taprootTweak?: Uint8Array;
}
export interface AggregateKey {
    preTweakedKey: Uint8Array;
    finalKey: Uint8Array;
}
export declare function aggregateKeys(publicKeys: Uint8Array[], sort: boolean, options?: Partial<KeyAggOptions>): AggregateKey;
export {};
