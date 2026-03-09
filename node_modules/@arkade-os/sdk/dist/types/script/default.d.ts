import { Bytes } from "@scure/btc-signer/utils.js";
import { TapLeafScript, VtxoScript } from "./base";
import { RelativeTimelock } from "./tapscript";
/**
 * DefaultVtxo is the default implementation of a VtxoScript.
 * It contains 1 forfeit path and 1 exit path.
 * - forfeit = (Alice + Server)
 * - exit = (Alice) after csvTimelock
 */
export declare namespace DefaultVtxo {
    /**
     * Options is the options for the DefaultVtxo.Script class.
     * csvTimelock is the exit path timelock, default is 144 blocks (1 day).
     */
    interface Options {
        pubKey: Bytes;
        serverPubKey: Bytes;
        csvTimelock?: RelativeTimelock;
    }
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
        readonly options: Options;
        static readonly DEFAULT_TIMELOCK: RelativeTimelock;
        readonly forfeitScript: string;
        readonly exitScript: string;
        constructor(options: Options);
        forfeit(): TapLeafScript;
        exit(): TapLeafScript;
    }
}
