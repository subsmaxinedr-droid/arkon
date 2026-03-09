/**
 * Watches multiple contracts for VTXO changes with resilient connection handling.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Failsafe polling to catch missed events
 * - Polls immediately after (re)connection to sync state
 * - Graceful handling of subscription failures
 *
 * @example
 * ```typescript
 * const watcher = new ContractWatcher({
 *   indexerProvider: wallet.indexerProvider,
 * });
 *
 * // Add the wallet's default contract
 * await watcher.addContract(defaultContract);
 *
 * // Add additional contracts (swaps, etc.)
 * await watcher.addContract(swapContract);
 *
 * // Start watching for events
 * const stop = await watcher.startWatching((event) => {
 *   console.log(`${event.type} on contract ${event.contractScript}`);
 * });
 *
 * // Later: stop watching
 * stop();
 * ```
 */
export class ContractWatcher {
    constructor(config) {
        this.contracts = new Map();
        this.isWatching = false;
        this.connectionState = "disconnected";
        this.reconnectAttempts = 0;
        this.config = {
            failsafePollIntervalMs: 60000, // 1 minute
            reconnectDelayMs: 1000, // 1 second
            maxReconnectDelayMs: 30000, // 30 seconds
            maxReconnectAttempts: 0, // unlimited
            ...config,
        };
    }
    /**
     * Add a contract to be watched.
     *
     * Active contracts are immediately subscribed. All contracts are polled
     * to discover any existing VTXOs (which may cause them to be watched
     * even if inactive).
     */
    async addContract(contract) {
        const state = {
            contract,
            lastKnownVtxos: new Map(),
        };
        this.contracts.set(contract.script, state);
        // If we're already watching, poll to discover VTXOs and update subscription
        if (this.isWatching) {
            // Poll first to discover VTXOs (may affect whether we watch this contract)
            await this.pollContracts([contract.script]);
            // Update subscription based on active state and VTXOs
            await this.tryUpdateSubscription();
        }
    }
    /**
     * Update an existing contract.
     */
    async updateContract(contract) {
        const existing = this.contracts.get(contract.script);
        if (!existing) {
            throw new Error(`Contract ${contract.script} not found`);
        }
        existing.contract = contract;
        if (this.isWatching) {
            await this.tryUpdateSubscription();
        }
    }
    /**
     * Remove a contract from watching.
     */
    async removeContract(contractScript) {
        const state = this.contracts.get(contractScript);
        if (state) {
            this.contracts.delete(contractScript);
            if (this.isWatching) {
                await this.tryUpdateSubscription();
            }
        }
    }
    /**
     * Get all in-memory contracts.
     */
    getAllContracts() {
        return Array.from(this.contracts.values()).map((s) => s.contract);
    }
    /**
     * Get all active in-memory contracts.
     */
    getActiveContracts() {
        return this.getAllContracts().filter((c) => c.state === "active");
    }
    /**
     * Get scripts that should be watched.
     *
     * Returns scripts for:
     * - All active contracts
     * - All contracts with known VTXOs (regardless of state)
     *
     * This ensures we continue monitoring contracts even after they're
     * deactivated, as long as they have unspent VTXOs.
     */
    getScriptsToWatch() {
        const scripts = new Set();
        for (const [, state] of this.contracts) {
            // Always watch active contracts
            if (state.contract.state === "active") {
                scripts.add(state.contract.script);
                continue;
            }
            // Also watch inactive/expired contracts that have VTXOs
            if (state.lastKnownVtxos.size > 0) {
                scripts.add(state.contract.script);
            }
        }
        return Array.from(scripts);
    }
    /**
     * Get VTXOs for contracts, grouped by contract script.
     * Uses Repository.
     */
    async getContractVtxos(options) {
        const { contractScripts, includeSpent } = options;
        const repo = this.config.walletRepository;
        const contractsToQuery = Array.from(this.contracts.values());
        const asyncResults = contractsToQuery
            .filter((_) => {
            if (contractScripts &&
                !contractScripts.includes(_.contract.script))
                return false;
            return true;
        })
            .map(async (state) => {
            // Use contract address as cache key
            const cached = await repo.getVtxos(state.contract.address);
            if (cached.length > 0) {
                // Convert to ContractVtxo with contractScript
                const contractVtxos = cached.map((v) => ({
                    ...v,
                    contractScript: state.contract.script,
                }));
                const filtered = includeSpent
                    ? contractVtxos
                    : contractVtxos.filter((v) => !v.isSpent);
                return [[state.contract.script, filtered]];
            }
            return [];
        });
        const results = await Promise.all(asyncResults);
        return new Map(results.flat(1));
    }
    /**
     * Start watching for VTXO events across all active contracts.
     */
    async startWatching(callback) {
        if (this.isWatching) {
            throw new Error("Already watching");
        }
        this.eventCallback = callback;
        this.isWatching = true;
        this.abortController = new AbortController();
        this.reconnectAttempts = 0;
        // Start connection
        await this.connect();
        // Start failsafe polling
        this.startFailsafePolling();
        return () => this.stopWatching();
    }
    /**
     * Stop watching for events.
     */
    async stopWatching() {
        this.isWatching = false;
        this.connectionState = "disconnected";
        this.abortController?.abort();
        // Clear timers
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = undefined;
        }
        if (this.failsafePollIntervalId) {
            clearInterval(this.failsafePollIntervalId);
            this.failsafePollIntervalId = undefined;
        }
        // Unsubscribe
        if (this.subscriptionId) {
            try {
                await this.config.indexerProvider.unsubscribeForScripts(this.subscriptionId);
            }
            catch {
                // Ignore unsubscribe errors
            }
            this.subscriptionId = undefined;
        }
        this.eventCallback = undefined;
    }
    /**
     * Check if currently watching.
     */
    isCurrentlyWatching() {
        return this.isWatching;
    }
    /**
     * Get current connection state.
     */
    getConnectionState() {
        return this.connectionState;
    }
    /**
     * Force a poll of all active contracts.
     * Useful for manual refresh or after app resume.
     */
    async forcePoll() {
        if (!this.isWatching)
            return;
        await this.pollAllContracts();
    }
    /**
     * Check for expired contracts, update their state, and emit events.
     */
    checkExpiredContracts() {
        const now = Date.now();
        const expired = [];
        for (const state of this.contracts.values()) {
            const contract = state.contract;
            if (contract.state === "active" &&
                contract.expiresAt &&
                contract.expiresAt <= now) {
                contract.state = "inactive";
                expired.push(contract);
                this.eventCallback?.({
                    type: "contract_expired",
                    contractScript: contract.script,
                    contract,
                    timestamp: now,
                });
            }
        }
    }
    /**
     * Connect to the subscription.
     */
    async connect() {
        if (!this.isWatching)
            return;
        this.connectionState = "connecting";
        try {
            await this.updateSubscription();
            // Poll immediately after connection to sync state
            await this.pollAllContracts();
            this.connectionState = "connected";
            this.reconnectAttempts = 0;
            // Start listening
            this.listenLoop().catch((e) => {
                // This is handled asynchronously otherwise `connect()` would hang
                // indefinitely and block the caller.
                // Error management must be implemented to ensure the connection
                // is restored and events are fired.
                console.error(e);
                this.connectionState = "disconnected";
                this.eventCallback?.({
                    type: "connection_reset",
                    timestamp: Date.now(),
                });
                this.scheduleReconnect();
            });
        }
        catch (error) {
            console.error("ContractWatcher connection failed:", error);
            this.connectionState = "disconnected";
            this.eventCallback?.({
                type: "connection_reset",
                timestamp: Date.now(),
            });
            this.scheduleReconnect();
        }
    }
    /**
     * Schedule a reconnection attempt.
     */
    scheduleReconnect() {
        if (!this.isWatching)
            return;
        // Check max attempts
        if (this.config.maxReconnectAttempts > 0 &&
            this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error(`ContractWatcher: Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`);
            return;
        }
        this.connectionState = "reconnecting";
        this.reconnectAttempts++;
        // Calculate delay with exponential backoff
        const delay = Math.min(this.config.reconnectDelayMs *
            Math.pow(2, this.reconnectAttempts - 1), this.config.maxReconnectDelayMs);
        this.reconnectTimeoutId = setTimeout(() => {
            this.reconnectTimeoutId = undefined;
            this.connect();
        }, delay);
    }
    /**
     * Start the failsafe polling interval.
     */
    startFailsafePolling() {
        if (this.failsafePollIntervalId) {
            clearInterval(this.failsafePollIntervalId);
        }
        this.failsafePollIntervalId = setInterval(() => {
            if (this.isWatching) {
                this.pollAllContracts().catch((error) => {
                    console.error("ContractWatcher failsafe poll failed:", error);
                });
            }
        }, this.config.failsafePollIntervalMs);
    }
    /**
     * Poll all active contracts for current state.
     */
    async pollAllContracts() {
        const activeScripts = this.getActiveContracts().map((c) => c.script);
        if (activeScripts.length === 0)
            return;
        await this.pollContracts(activeScripts);
    }
    /**
     * Poll specific contracts and emit events for changes.
     */
    async pollContracts(contractScripts) {
        if (!this.eventCallback)
            return;
        const now = Date.now();
        try {
            // Load all the VTXOs for these contracts, from DB
            const vtxosMap = await this.getContractVtxos({
                contractScripts,
                includeSpent: false, // only spendable ones!
            });
            for (const contractScript of contractScripts) {
                const state = this.contracts.get(contractScript);
                if (!state)
                    continue;
                const currentVtxos = vtxosMap.get(contractScript) || [];
                const currentKeys = new Set(currentVtxos.map((v) => `${v.txid}:${v.vout}`));
                // Find new VTXOs and add them to the contract's state
                const newVtxos = [];
                for (const vtxo of currentVtxos) {
                    const key = `${vtxo.txid}:${vtxo.vout}`;
                    if (!state.lastKnownVtxos.has(key)) {
                        newVtxos.push(vtxo);
                        state.lastKnownVtxos.set(key, vtxo);
                    }
                }
                // Find spent VTXOs and remove them from the contract's state
                const spentVtxos = [];
                for (const [key, vtxo] of state.lastKnownVtxos) {
                    if (!currentKeys.has(key)) {
                        spentVtxos.push(vtxo);
                        state.lastKnownVtxos.delete(key);
                    }
                }
                // Emit events
                if (newVtxos.length > 0) {
                    this.emitVtxoEvent(contractScript, newVtxos, "vtxo_received", now);
                }
                if (spentVtxos.length > 0) {
                    // Note: We can't distinguish spent vs swept from polling alone
                    // The subscription provides more accurate event types
                    this.emitVtxoEvent(contractScript, spentVtxos, "vtxo_spent", now);
                }
            }
        }
        catch (error) {
            console.error("ContractWatcher poll failed:", error);
            // Don't throw - polling failures shouldn't crash the watcher
        }
    }
    async tryUpdateSubscription() {
        try {
            await this.updateSubscription();
        }
        catch (error) {
            // nothing, the connection will be retried later
        }
    }
    /**
     * Update the subscription with scripts that should be watched.
     *
     * Watches both active contracts and contracts with VTXOs.
     */
    async updateSubscription() {
        const scriptsToWatch = this.getScriptsToWatch();
        if (scriptsToWatch.length === 0) {
            if (this.subscriptionId) {
                try {
                    await this.config.indexerProvider.unsubscribeForScripts(this.subscriptionId);
                }
                catch {
                    // Ignore
                }
                this.subscriptionId = undefined;
            }
            return;
        }
        this.subscriptionId =
            await this.config.indexerProvider.subscribeForScripts(scriptsToWatch, this.subscriptionId);
    }
    /**
     * Main listening loop for subscription events.
     */
    async listenLoop() {
        if (!this.subscriptionId || !this.abortController || !this.isWatching) {
            if (this.isWatching) {
                this.connectionState = "disconnected";
                this.scheduleReconnect();
            }
            return;
        }
        const subscription = this.config.indexerProvider.getSubscription(this.subscriptionId, this.abortController.signal);
        for await (const update of subscription) {
            if (!this.isWatching)
                break;
            this.handleSubscriptionUpdate(update);
        }
        // Stream ended normally - reconnect if still watching
        if (this.isWatching) {
            this.connectionState = "disconnected";
            this.scheduleReconnect();
        }
    }
    /**
     * Handle a subscription update.
     */
    handleSubscriptionUpdate(update) {
        if (!this.eventCallback)
            return;
        const timestamp = Date.now();
        const scripts = update.scripts || [];
        if (update.newVtxos?.length) {
            this.processSubscriptionVtxos(update.newVtxos, scripts, "vtxo_received", timestamp);
        }
        if (update.spentVtxos?.length) {
            this.processSubscriptionVtxos(update.spentVtxos, scripts, "vtxo_spent", timestamp);
        }
    }
    /**
     * Process VTXOs from subscription and route to correct contracts.
     * Uses the scripts from the subscription response to determine contract ownership.
     */
    processSubscriptionVtxos(vtxos, scripts, eventType, timestamp) {
        // If we have exactly one script, all VTXOs belong to that contract
        // Otherwise, we can't reliably determine ownership without script in VirtualCoin
        if (scripts.length === 1) {
            const contractScript = scripts[0];
            if (contractScript) {
                // Update tracking
                const state = this.contracts.get(contractScript);
                if (state) {
                    for (const vtxo of vtxos) {
                        const key = `${vtxo.txid}:${vtxo.vout}`;
                        if (eventType === "vtxo_received") {
                            state.lastKnownVtxos.set(key, vtxo);
                        }
                        else if (eventType === "vtxo_spent") {
                            state.lastKnownVtxos.delete(key);
                        }
                    }
                }
                this.emitVtxoEvent(contractScript, vtxos, eventType, timestamp);
            }
            return;
        }
        // Multiple scripts - assign VTXOs to all matching contracts
        // This is a limitation: we can't know which VTXO belongs to which script
        // In practice, subscription events usually come with a single script context
        for (const script of scripts) {
            const contractScript = script;
            if (contractScript) {
                const state = this.contracts.get(contractScript);
                if (state) {
                    for (const vtxo of vtxos) {
                        const key = `${vtxo.txid}:${vtxo.vout}`;
                        if (eventType === "vtxo_received") {
                            state.lastKnownVtxos.set(key, vtxo);
                        }
                        else {
                            state.lastKnownVtxos.delete(key);
                        }
                    }
                }
                this.emitVtxoEvent(contractScript, vtxos, eventType, timestamp);
            }
        }
    }
    /**
     * Emit a VTXO event for a contract.
     */
    emitVtxoEvent(contractScript, vtxos, eventType, timestamp) {
        if (!this.eventCallback)
            return;
        const state = this.contracts.get(contractScript);
        // ensure we check somehow regularly
        this.checkExpiredContracts();
        switch (eventType) {
            case "vtxo_received":
                if (!state)
                    return;
                this.eventCallback({
                    type: "vtxo_received",
                    vtxos: vtxos.map((v) => ({
                        ...v,
                        contractScript,
                        // These fields may not be available from basic VirtualCoin
                        forfeitTapLeafScript: undefined,
                        intentTapLeafScript: undefined,
                        tapTree: undefined,
                    })),
                    contractScript,
                    contract: state.contract,
                    timestamp,
                });
                return;
            case "vtxo_spent":
                if (!state)
                    return;
                this.eventCallback({
                    type: "vtxo_spent",
                    vtxos: vtxos.map((v) => ({
                        ...v,
                        contractScript,
                        // These fields may not be available from basic VirtualCoin
                        forfeitTapLeafScript: undefined,
                        intentTapLeafScript: undefined,
                        tapTree: undefined,
                    })),
                    contractScript,
                    contract: state.contract,
                    timestamp,
                });
                return;
            case "contract_expired":
                if (!state)
                    return;
                this.eventCallback({
                    type: "contract_expired",
                    contractScript,
                    contract: state.contract,
                    timestamp,
                });
                return;
            default:
                return;
        }
    }
}
