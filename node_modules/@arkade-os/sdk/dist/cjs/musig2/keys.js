"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateKeys = aggregateKeys;
const musig = __importStar(require("@scure/btc-signer/musig2.js"));
const secp256k1_js_1 = require("@noble/curves/secp256k1.js");
// Aggregates multiple public keys according to the MuSig2 algorithm
function aggregateKeys(publicKeys, sort, options = {}) {
    if (sort) {
        publicKeys = musig.sortKeys(publicKeys);
    }
    const { aggPublicKey: preTweakedKey } = musig.keyAggregate(publicKeys);
    if (!options.taprootTweak) {
        return {
            preTweakedKey: preTweakedKey.toBytes(true),
            finalKey: preTweakedKey.toBytes(true),
        };
    }
    const tweakBytes = secp256k1_js_1.schnorr.utils.taggedHash("TapTweak", preTweakedKey.toBytes(true).subarray(1), options.taprootTweak ?? new Uint8Array(0));
    const { aggPublicKey: finalKey } = musig.keyAggregate(publicKeys, [tweakBytes], [true]);
    return {
        preTweakedKey: preTweakedKey.toBytes(true),
        finalKey: finalKey.toBytes(true),
    };
}
