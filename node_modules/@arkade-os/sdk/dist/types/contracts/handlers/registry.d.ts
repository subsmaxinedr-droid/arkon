import { ContractHandler } from "../types";
/**
 * Registry for contract handlers.
 *
 * Each contract type ("default", "vhtlc", etc.) has a handler that knows
 * how to create VtxoScripts, serialize params, and select spending paths.
 *
 * @example
 * ```typescript
 * // Register a custom handler
 * contractHandlers.register(myCustomHandler);
 *
 * // Get handler for a type
 * const handler = contractHandlers.get("vhtlc");
 * const script = handler.createScript(contract.params);
 * ```
 */
declare class ContractHandlerRegistry {
    private handlers;
    /**
     * Register a contract handler.
     *
     * @param handler - The handler to register
     * @throws If a handler for this type is already registered
     */
    register(handler: ContractHandler<unknown>): void;
    /**
     * Get a handler by type.
     *
     * @param type - The contract type
     * @returns The handler, or undefined if not found
     */
    get(type: string): ContractHandler<unknown> | undefined;
    /**
     * Get a handler by type, throwing if not found.
     *
     * @param type - The contract type
     * @returns The handler
     * @throws If no handler is registered for this type
     */
    getOrThrow(type: string): ContractHandler<unknown>;
    /**
     * Check if a handler is registered.
     *
     * @param type - The contract type
     */
    has(type: string): boolean;
    /**
     * Get all registered types.
     */
    getRegisteredTypes(): string[];
    /**
     * Unregister a handler (mainly for testing).
     */
    unregister(type: string): boolean;
    /**
     * Clear all handlers (mainly for testing).
     */
    clear(): void;
}
/**
 * Global registry of contract handlers.
 */
export declare const contractHandlers: ContractHandlerRegistry;
export {};
