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
exports.getExpoFetch = getExpoFetch;
exports.sseStreamIterator = sseStreamIterator;
/**
 * Dynamically imports expo/fetch with fallback to standard fetch.
 * @returns A fetch function suitable for SSE streaming
 */
async function getExpoFetch(options) {
    const requireExpo = options?.requireExpo ?? false;
    try {
        const expoFetchModule = await Promise.resolve().then(() => __importStar(require("expo/fetch")));
        console.debug("Using expo/fetch for streaming");
        return expoFetchModule.fetch;
    }
    catch (error) {
        if (requireExpo) {
            throw new Error("expo/fetch is unavailable in this environment. " +
                "Please ensure expo/fetch is installed and properly configured.");
        }
        console.warn("Using standard fetch instead of expo/fetch. " +
            "Streaming may not be fully supported in some environments.", error);
        return fetch;
    }
}
/**
 * Generic SSE stream processor using fetch API with ReadableStream.
 * Handles SSE format parsing, buffer management, and abort signals.
 *
 * @param url - The SSE endpoint URL
 * @param abortSignal - Signal to abort the stream
 * @param fetchFn - Fetch function to use (defaults to standard fetch)
 * @param headers - Additional headers to send
 * @param parseData - Function to parse and yield data from SSE events
 */
async function* sseStreamIterator(url, abortSignal, fetchFn, headers, parseData) {
    const fetchController = new AbortController();
    const cleanup = () => fetchController.abort();
    abortSignal?.addEventListener("abort", cleanup, { once: true });
    try {
        const response = await fetchFn(url, {
            headers: {
                Accept: "text/event-stream",
                ...headers,
            },
            signal: fetchController.signal,
        });
        if (!response.ok) {
            throw new Error(`Unexpected status ${response.status} when fetching SSE stream`);
        }
        if (!response.body) {
            throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!abortSignal?.aborted) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i].trim();
                if (!line)
                    continue;
                if (line.startsWith("data:")) {
                    const jsonStr = line.substring(5).trim();
                    if (!jsonStr)
                        continue;
                    try {
                        const data = JSON.parse(jsonStr);
                        const parsed = parseData(data);
                        if (parsed !== null) {
                            yield parsed;
                        }
                    }
                    catch (parseError) {
                        console.error("Failed to parse SSE data:", parseError);
                        throw parseError;
                    }
                }
            }
            buffer = lines[lines.length - 1];
        }
    }
    finally {
        abortSignal?.removeEventListener("abort", cleanup);
    }
}
