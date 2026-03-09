"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrMissingCosignersPublicKeys = exports.ErrWrongCommitmentTxid = exports.ErrInvalidRoundTxOutputs = exports.ErrInvalidTaprootScript = exports.ErrNoLeaves = exports.ErrInvalidAmount = exports.ErrWrongSettlementTxid = exports.ErrNumberOfInputs = exports.ErrEmptyTree = exports.ErrInvalidSettlementTxOutputs = exports.ErrInvalidSettlementTx = void 0;
exports.validateConnectorsTxGraph = validateConnectorsTxGraph;
exports.validateVtxoTxGraph = validateVtxoTxGraph;
const base_1 = require("@scure/base");
const transaction_js_1 = require("@scure/btc-signer/transaction.js");
const base_2 = require("@scure/base");
const musig2_1 = require("../musig2");
const unknownFields_1 = require("../utils/unknownFields");
const ErrInvalidSettlementTx = (tx) => new Error(`invalid settlement transaction: ${tx}`);
exports.ErrInvalidSettlementTx = ErrInvalidSettlementTx;
exports.ErrInvalidSettlementTxOutputs = new Error("invalid settlement transaction outputs");
exports.ErrEmptyTree = new Error("empty tree");
exports.ErrNumberOfInputs = new Error("invalid number of inputs");
exports.ErrWrongSettlementTxid = new Error("wrong settlement txid");
exports.ErrInvalidAmount = new Error("invalid amount");
exports.ErrNoLeaves = new Error("no leaves");
exports.ErrInvalidTaprootScript = new Error("invalid taproot script");
exports.ErrInvalidRoundTxOutputs = new Error("invalid round transaction outputs");
exports.ErrWrongCommitmentTxid = new Error("wrong commitment txid");
exports.ErrMissingCosignersPublicKeys = new Error("missing cosigners public keys");
const BATCH_OUTPUT_VTXO_INDEX = 0;
const BATCH_OUTPUT_CONNECTORS_INDEX = 1;
function validateConnectorsTxGraph(settlementTxB64, connectorsGraph) {
    connectorsGraph.validate();
    if (connectorsGraph.root.inputsLength !== 1)
        throw exports.ErrNumberOfInputs;
    const rootInput = connectorsGraph.root.getInput(0);
    const settlementTx = transaction_js_1.Transaction.fromPSBT(base_2.base64.decode(settlementTxB64));
    if (settlementTx.outputsLength <= BATCH_OUTPUT_CONNECTORS_INDEX)
        throw exports.ErrInvalidSettlementTxOutputs;
    const expectedRootTxid = settlementTx.id;
    if (!rootInput.txid)
        throw exports.ErrWrongSettlementTxid;
    if (base_1.hex.encode(rootInput.txid) !== expectedRootTxid)
        throw exports.ErrWrongSettlementTxid;
    if (rootInput.index !== BATCH_OUTPUT_CONNECTORS_INDEX)
        throw exports.ErrWrongSettlementTxid;
}
// ValidateVtxoTxGraph checks if the given vtxo graph is valid.
// The function validates:
// - the number of nodes
// - the number of leaves
// - children coherence with parent.
// - every control block and taproot output scripts.
// - input and output amounts.
function validateVtxoTxGraph(graph, roundTransaction, sweepTapTreeRoot) {
    if (roundTransaction.outputsLength < BATCH_OUTPUT_VTXO_INDEX + 1) {
        throw exports.ErrInvalidRoundTxOutputs;
    }
    const batchOutputAmount = roundTransaction.getOutput(BATCH_OUTPUT_VTXO_INDEX)?.amount;
    if (!batchOutputAmount) {
        throw exports.ErrInvalidRoundTxOutputs;
    }
    if (!graph.root) {
        throw exports.ErrEmptyTree;
    }
    const rootInput = graph.root.getInput(0);
    const commitmentTxid = roundTransaction.id;
    if (!rootInput.txid ||
        base_1.hex.encode(rootInput.txid) !== commitmentTxid ||
        rootInput.index !== BATCH_OUTPUT_VTXO_INDEX) {
        throw exports.ErrWrongCommitmentTxid;
    }
    let sumRootValue = 0n;
    for (let i = 0; i < graph.root.outputsLength; i++) {
        const output = graph.root.getOutput(i);
        if (output?.amount) {
            sumRootValue += output.amount;
        }
    }
    if (sumRootValue !== batchOutputAmount) {
        throw exports.ErrInvalidAmount;
    }
    const leaves = graph.leaves();
    if (leaves.length === 0) {
        throw exports.ErrNoLeaves;
    }
    // validate the graph structure
    graph.validate();
    // iterates over all the nodes of the graph to verify that cosigners public keys are corresponding to the parent output
    for (const g of graph.iterator()) {
        for (const [childIndex, child] of g.children) {
            const parentOutput = g.root.getOutput(childIndex);
            if (!parentOutput?.script) {
                throw new Error(`parent output ${childIndex} not found`);
            }
            const previousScriptKey = parentOutput.script.slice(2);
            if (previousScriptKey.length !== 32) {
                throw new Error(`parent output ${childIndex} has invalid script`);
            }
            const cosigners = (0, unknownFields_1.getArkPsbtFields)(child.root, 0, unknownFields_1.CosignerPublicKey);
            if (cosigners.length === 0) {
                throw exports.ErrMissingCosignersPublicKeys;
            }
            const cosignerKeys = cosigners.map((c) => c.key);
            const { finalKey } = (0, musig2_1.aggregateKeys)(cosignerKeys, true, {
                taprootTweak: sweepTapTreeRoot,
            });
            if (!finalKey ||
                base_1.hex.encode(finalKey.slice(1)) !== base_1.hex.encode(previousScriptKey)) {
                throw exports.ErrInvalidTaprootScript;
            }
        }
    }
}
