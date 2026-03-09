import { RestIndexerProvider, SubscriptionResponse } from "./indexer";
/**
 * Expo-compatible Indexer provider implementation using expo/fetch for streaming support.
 * This provider works specifically in React Native/Expo environments where
 * standard fetch streaming may not work properly but expo/fetch provides streaming capabilities.
 *
 * @example
 * ```typescript
 * import { ExpoIndexerProvider } from '@arkade-os/sdk/adapters/expo';
 *
 * const provider = new ExpoIndexerProvider('https://indexer.example.com');
 * const vtxos = await provider.getVtxos({ scripts: ['script1'] });
 * ```
 */
export declare class ExpoIndexerProvider extends RestIndexerProvider {
    constructor(serverUrl: string);
    getSubscription(subscriptionId: string, abortSignal: AbortSignal): AsyncIterableIterator<SubscriptionResponse>;
}
