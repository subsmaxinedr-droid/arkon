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
exports.timelockToSequence = timelockToSequence;
exports.sequenceToTimelock = sequenceToTimelock;
exports.resolveRole = resolveRole;
exports.isCsvSpendable = isCsvSpendable;
const bip68 = __importStar(require("bip68"));
/**
 * Convert RelativeTimelock to BIP68 sequence number.
 */
function timelockToSequence(timelock) {
    return bip68.encode(timelock.type === "blocks"
        ? { blocks: Number(timelock.value) }
        : { seconds: Number(timelock.value) });
}
/**
 * Convert BIP68 sequence number back to RelativeTimelock.
 */
function sequenceToTimelock(sequence) {
    const decoded = bip68.decode(sequence);
    if ("blocks" in decoded && decoded.blocks !== undefined) {
        return { type: "blocks", value: BigInt(decoded.blocks) };
    }
    if ("seconds" in decoded && decoded.seconds !== undefined) {
        return { type: "seconds", value: BigInt(decoded.seconds) };
    }
    throw new Error(`Invalid BIP68 sequence: ${sequence}`);
}
/**
 * Resolve wallet's role from explicit role or by matching pubkey.
 */
function resolveRole(contract, context) {
    // Explicit role takes precedence
    if (context.role === "sender" || context.role === "receiver") {
        return context.role;
    }
    // Try to match wallet pubkey against contract params
    if (context.walletPubKey) {
        if (context.walletPubKey === contract.params.sender) {
            return "sender";
        }
        if (context.walletPubKey === contract.params.receiver) {
            return "receiver";
        }
    }
    return undefined;
}
/**
 * Check if a CSV timelock is currently satisfied for the given context/VTXO.
 */
function isCsvSpendable(context, sequence) {
    if (sequence === undefined)
        return true;
    if (!context.vtxo)
        return false;
    const timelock = sequenceToTimelock(sequence);
    if (timelock.type === "blocks") {
        if (context.blockHeight === undefined ||
            context.vtxo.status.block_height === undefined) {
            return false;
        }
        return (context.blockHeight - context.vtxo.status.block_height >=
            Number(timelock.value));
    }
    if (timelock.type === "seconds") {
        const blockTime = context.vtxo.status.block_time;
        if (blockTime === undefined)
            return false;
        return context.currentTime / 1000 - blockTime >= Number(timelock.value);
    }
    return false;
}
