"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.networks = exports.getNetwork = void 0;
const utils_js_1 = require("@scure/btc-signer/utils.js");
const getNetwork = (network) => {
    return exports.networks[network];
};
exports.getNetwork = getNetwork;
exports.networks = {
    bitcoin: withArkPrefix(utils_js_1.NETWORK, "ark"),
    testnet: withArkPrefix(utils_js_1.TEST_NETWORK, "tark"),
    signet: withArkPrefix(utils_js_1.TEST_NETWORK, "tark"),
    mutinynet: withArkPrefix(utils_js_1.TEST_NETWORK, "tark"),
    regtest: withArkPrefix({
        ...utils_js_1.TEST_NETWORK,
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
