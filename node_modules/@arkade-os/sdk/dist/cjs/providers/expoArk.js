"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpoArkProvider = void 0;
const ark_1 = require("./ark");
const expoUtils_1 = require("./expoUtils");
/**
 * Expo-compatible Ark provider implementation using expo/fetch for SSE support.
 * This provider works specifically in React Native/Expo environments where
 * standard EventSource is not available but expo/fetch provides SSE capabilities.
 *
 * @example
 * ```typescript
 * import { ExpoArkProvider } from '@arkade-os/sdk/providers/expo';
 *
 * const provider = new ExpoArkProvider('https://ark.example.com');
 * const info = await provider.getInfo();
 * ```
 */
class ExpoArkProvider extends ark_1.RestArkProvider {
    constructor(serverUrl) {
        super(serverUrl);
    }
    async *getEventStream(signal, topics) {
        const expoFetch = await (0, expoUtils_1.getExpoFetch)();
        const url = `${this.serverUrl}/v1/batch/events`;
        const queryParams = topics.length > 0
            ? `?${topics.map((topic) => `topics=${encodeURIComponent(topic)}`).join("&")}`
            : "";
        while (!signal?.aborted) {
            try {
                yield* (0, expoUtils_1.sseStreamIterator)(url + queryParams, signal, expoFetch, {}, (data) => {
                    // Handle different response structures
                    // v8 mesh API might wrap in {result: ...} or send directly
                    const eventData = data.result || data;
                    // Skip heartbeat messages
                    if (eventData.heartbeat !== undefined) {
                        return null;
                    }
                    return this.parseSettlementEvent(eventData);
                });
            }
            catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    break;
                }
                // ignore timeout errors, they're expected when the server is not sending anything for 5 min
                // these timeouts are set by expo/fetch function
                if ((0, ark_1.isFetchTimeoutError)(error)) {
                    console.debug("Timeout error ignored");
                    continue;
                }
                console.error("Event stream error:", error);
                throw error;
            }
        }
    }
    async *getTransactionsStream(signal) {
        const expoFetch = await (0, expoUtils_1.getExpoFetch)();
        const url = `${this.serverUrl}/v1/txs`;
        while (!signal?.aborted) {
            try {
                yield* (0, expoUtils_1.sseStreamIterator)(url, signal, expoFetch, {}, (data) => {
                    return this.parseTransactionNotification(data.result);
                });
            }
            catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    break;
                }
                // ignore timeout errors, they're expected when the server is not sending anything for 5 min
                // these timeouts are set by expo/fetch function
                if ((0, ark_1.isFetchTimeoutError)(error)) {
                    console.debug("Timeout error ignored");
                    continue;
                }
                console.error("Transaction stream error:", error);
                throw error;
            }
        }
    }
}
exports.ExpoArkProvider = ExpoArkProvider;
