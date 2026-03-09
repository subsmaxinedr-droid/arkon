export type NetworkName = "bitcoin" | "testnet" | "signet" | "mutinynet" | "regtest";
export interface Network {
    hrp: string;
    bech32: string;
    pubKeyHash: number;
    scriptHash: number;
    wif: number;
}
export declare const getNetwork: (network: NetworkName) => Network;
export declare const networks: {
    bitcoin: Network;
    testnet: Network;
    signet: Network;
    mutinynet: Network;
    regtest: Network;
};
