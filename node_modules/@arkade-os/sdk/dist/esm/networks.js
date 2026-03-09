import { NETWORK, TEST_NETWORK } from "@scure/btc-signer/utils.js";
export const getNetwork = (network) => {
    return networks[network];
};
export const networks = {
    bitcoin: withArkPrefix(NETWORK, "ark"),
    testnet: withArkPrefix(TEST_NETWORK, "tark"),
    signet: withArkPrefix(TEST_NETWORK, "tark"),
    mutinynet: withArkPrefix(TEST_NETWORK, "tark"),
    regtest: withArkPrefix({
        ...TEST_NETWORK,
        bech32: "bcrt",
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
    }, "tark"),
};
function withArkPrefix(network, prefix) {
    return {
        ...network,
        hrp: prefix,
    };
}
