/**
 * Dynamically imports expo/fetch with fallback to standard fetch.
 * @returns A fetch function suitable for SSE streaming
 */
export declare function getExpoFetch(options?: {
    requireExpo?: boolean;
}): Promise<typeof fetch>;
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
export declare function sseStreamIterator<T>(url: string, abortSignal: AbortSignal, fetchFn: typeof fetch, headers: Record<string, string>, parseData: (data: any) => T | null): AsyncGenerator<T, void, unknown>;
