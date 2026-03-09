"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultVtxo = void 0;
const base_1 = require("./base");
const tapscript_1 = require("./tapscript");
const base_2 = require("@scure/base");
/**
 * DefaultVtxo is the default implementation of a VtxoScript.
 * It contains 1 forfeit path and 1 exit path.
 * - forfeit = (Alice + Server)
 * - exit = (Alice) after csvTimelock
 */
var DefaultVtxo;
(function (DefaultVtxo) {
    /**
     * DefaultVtxo.Script is the class letting to create the vtxo script.
     * @example
     * ```typescript
     * const vtxoScript = new DefaultVtxo.Script({
     *     pubKey: new Uint8Array(32),
     *     serverPubKey: new Uint8Array(32),
     * });
     *
     * console.log("script pub key:", vtxoScript.pkScript)
     * ```
     */
    class Script extends base_1.VtxoScript {
        constructor(options) {
            const { pubKey, serverPubKey, csvTimelock = Script.DEFAULT_TIMELOCK, } = options;
            const forfeitScript = tapscript_1.MultisigTapscript.encode({
                pubkeys: [pubKey, serverPubKey],
            }).script;
            const exitScript = tapscript_1.CSVMultisigTapscript.encode({
                timelock: csvTimelock,
                pubkeys: [pubKey],
            }).script;
            super([forfeitScript, exitScript]);
            this.options = options;
            this.forfeitScript = base_2.hex.encode(forfeitScript);
            this.exitScript = base_2.hex.encode(exitScript);
        }
        forfeit() {
            return this.findLeaf(this.forfeitScript);
        }
        exit() {
            return this.findLeaf(this.exitScript);
        }
    }
    Script.DEFAULT_TIMELOCK = {
        value: 144n,
        type: "blocks",
    }; // 1 day in blocks
    DefaultVtxo.Script = Script;
})(DefaultVtxo || (exports.DefaultVtxo = DefaultVtxo = {}));
