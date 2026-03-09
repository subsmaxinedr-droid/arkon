import { RestArkProvider, SettlementEvent, TxNotification } from "./ark";
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
export declare class ExpoArkProvider extends RestArkProvider {
    constructor(serverUrl: string);
    getEventStream(signal: AbortSignal, topics: string[]): AsyncIterableIterator<SettlementEvent>;
    getTransactionsStream(signal: AbortSignal): AsyncIterableIterator<{
        commitmentTx?: TxNotification;
        arkTx?: TxNotification;
    }>;
}
