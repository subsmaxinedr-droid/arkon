import { VtxoScript } from './base.js';
import { CSVMultisigTapscript, MultisigTapscript, } from './tapscript.js';
import { hex } from "@scure/base";
/**
 * DefaultVtxo is the default implementation of a VtxoScript.
 * It contains 1 forfeit path and 1 exit path.
 * - forfeit = (Alice + Server)
 * - exit = (Alice) after csvTimelock
 */
export var DefaultVtxo;
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
    class Script extends VtxoScript {
        constructor(options) {
            const { pubKey, serverPubKey, csvTimelock = Script.DEFAULT_TIMELOCK, } = options;
            const forfeitScript = MultisigTapscript.encode({
                pubkeys: [pubKey, serverPubKey],
            }).script;
            const exitScript = CSVMultisigTapscript.encode({
                timelock: csvTimelock,
                pubkeys: [pubKey],
            }).script;
            super([forfeitScript, exitScript]);
            this.options = options;
            this.forfeitScript = hex.encode(forfeitScript);
            this.exitScript = hex.encode(exitScript);
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
})(DefaultVtxo || (DefaultVtxo = {}));
