import * as musig2 from '../musig2/index.js';
import { Script } from "@scure/btc-signer/script.js";
import { SigHash } from "@scure/btc-signer/transaction.js";
import { hex } from "@scure/base";
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import { randomPrivateKeyBytes } from "@scure/btc-signer/utils.js";
import { CosignerPublicKey, getArkPsbtFields } from '../utils/unknownFields.js';
export const ErrMissingVtxoGraph = new Error("missing vtxo graph");
export const ErrMissingAggregateKey = new Error("missing aggregate key");
export class TreeSignerSession {
    constructor(secretKey) {
        this.secretKey = secretKey;
        this.myNonces = null;
        this.aggregateNonces = null;
        this.graph = null;
        this.scriptRoot = null;
        this.rootSharedOutputAmount = null;
    }
    static random() {
        const secretKey = randomPrivateKeyBytes();
        return new TreeSignerSession(secretKey);
    }
    async init(tree, scriptRoot, rootInputAmount) {
        this.graph = tree;
        this.scriptRoot = scriptRoot;
        this.rootSharedOutputAmount = rootInputAmount;
    }
    async getPublicKey() {
        return secp256k1.getPublicKey(this.secretKey);
    }
    async getNonces() {
        if (!this.graph)
            throw ErrMissingVtxoGraph;
        if (!this.myNonces) {
            this.myNonces = this.generateNonces();
        }
        const publicNonces = new Map();
        for (const [txid, nonces] of this.myNonces) {
            publicNonces.set(txid, { pubNonce: nonces.pubNonce });
        }
        return publicNonces;
    }
    async aggregatedNonces(txid, noncesByPubkey) {
        if (!this.graph)
            throw ErrMissingVtxoGraph;
        if (!this.aggregateNonces) {
            this.aggregateNonces = new Map();
        }
        if (!this.myNonces) {
            await this.getNonces(); // generate nonces if not generated yet
        }
        if (this.aggregateNonces.has(txid)) {
            return {
                hasAllNonces: this.aggregateNonces.size === this.myNonces?.size,
            };
        }
        const myNonce = this.myNonces.get(txid);
        if (!myNonce)
            throw new Error(`missing nonce for txid ${txid}`);
        const myPublicKey = await this.getPublicKey();
        // set my nonce to not rely on server
        noncesByPubkey.set(hex.encode(myPublicKey.subarray(1)), myNonce);
        const tx = this.graph.find(txid);
        if (!tx)
            throw new Error(`missing tx for txid ${txid}`);
        const cosigners = getArkPsbtFields(tx.root, 0, CosignerPublicKey).map((c) => hex.encode(c.key.subarray(1)) // xonly pubkey
        );
        const pubNonces = [];
        for (const cosigner of cosigners) {
            const nonce = noncesByPubkey.get(cosigner);
            if (!nonce) {
                throw new Error(`missing nonce for cosigner ${cosigner}`);
            }
            pubNonces.push(nonce.pubNonce);
        }
        const aggregateNonce = musig2.aggregateNonces(pubNonces);
        this.aggregateNonces.set(txid, { pubNonce: aggregateNonce });
        return {
            hasAllNonces: this.aggregateNonces.size === this.myNonces?.size,
        };
    }
    async sign() {
        if (!this.graph)
            throw ErrMissingVtxoGraph;
        if (!this.aggregateNonces)
            throw new Error("nonces not set");
        if (!this.myNonces)
            throw new Error("nonces not generated");
        const sigs = new Map();
        for (const g of this.graph.iterator()) {
            const sig = this.signPartial(g);
            sigs.set(g.txid, sig);
        }
        return sigs;
    }
    generateNonces() {
        if (!this.graph)
            throw ErrMissingVtxoGraph;
        const myNonces = new Map();
        const publicKey = secp256k1.getPublicKey(this.secretKey);
        for (const g of this.graph.iterator()) {
            const nonces = musig2.generateNonces(publicKey);
            myNonces.set(g.txid, nonces);
        }
        return myNonces;
    }
    signPartial(g) {
        if (!this.graph || !this.scriptRoot || !this.rootSharedOutputAmount) {
            throw TreeSignerSession.NOT_INITIALIZED;
        }
        if (!this.myNonces || !this.aggregateNonces) {
            throw new Error("session not properly initialized");
        }
        const myNonce = this.myNonces.get(g.txid);
        if (!myNonce)
            throw new Error("missing private nonce");
        const aggNonce = this.aggregateNonces.get(g.txid);
        if (!aggNonce)
            throw new Error("missing aggregate nonce");
        const prevoutAmounts = [];
        const prevoutScripts = [];
        const cosigners = getArkPsbtFields(g.root, 0, CosignerPublicKey).map((c) => c.key);
        const { finalKey } = musig2.aggregateKeys(cosigners, true, {
            taprootTweak: this.scriptRoot,
        });
        for (let inputIndex = 0; inputIndex < g.root.inputsLength; inputIndex++) {
            const prevout = getPrevOutput(finalKey, this.graph, this.rootSharedOutputAmount, g.root);
            prevoutAmounts.push(prevout.amount);
            prevoutScripts.push(prevout.script);
        }
        const message = g.root.preimageWitnessV1(0, // always first input
        prevoutScripts, SigHash.DEFAULT, prevoutAmounts);
        return musig2.sign(myNonce.secNonce, this.secretKey, aggNonce.pubNonce, cosigners, message, {
            taprootTweak: this.scriptRoot,
            sortKeys: true,
        });
    }
}
TreeSignerSession.NOT_INITIALIZED = new Error("session not initialized, call init method");
// Helper function to validate tree signatures
export async function validateTreeSigs(finalAggregatedKey, sharedOutputAmount, vtxoTree) {
    // Iterate through each level of the tree
    for (const g of vtxoTree.iterator()) {
        // Parse the transaction
        const input = g.root.getInput(0);
        // Check if input has signature
        if (!input.tapKeySig) {
            throw new Error("unsigned tree input");
        }
        // Get the previous output information
        const prevout = getPrevOutput(finalAggregatedKey, vtxoTree, sharedOutputAmount, g.root);
        // Calculate the message that was signed
        const message = g.root.preimageWitnessV1(0, // always first input
        [prevout.script], SigHash.DEFAULT, [prevout.amount]);
        // Verify the signature
        const isValid = schnorr.verify(input.tapKeySig, message, finalAggregatedKey);
        if (!isValid) {
            throw new Error("invalid signature");
        }
    }
}
function getPrevOutput(finalKey, graph, sharedOutputAmount, tx) {
    // generate P2TR script from musig2 final key
    const pkScript = Script.encode(["OP_1", finalKey.slice(1)]);
    // if the input is the root input, return the shared output amount
    if (tx.id === graph.txid) {
        return {
            amount: sharedOutputAmount,
            script: pkScript,
        };
    }
    // find the parent transaction
    const parentInput = tx.getInput(0);
    if (!parentInput.txid)
        throw new Error("missing parent input txid");
    const parentTxid = hex.encode(parentInput.txid);
    const parent = graph.find(parentTxid);
    if (!parent)
        throw new Error("parent  tx not found");
    if (parentInput.index === undefined)
        throw new Error("missing input index");
    const parentOutput = parent.root.getOutput(parentInput.index);
    if (!parentOutput)
        throw new Error("parent output not found");
    if (!parentOutput.amount)
        throw new Error("parent output amount not found");
    return {
        amount: parentOutput.amount,
        script: pkScript,
    };
}
