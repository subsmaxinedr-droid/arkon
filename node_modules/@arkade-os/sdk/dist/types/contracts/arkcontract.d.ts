import { Contract } from "./types";
/**
 * Encode a contract to the arkcontract string format.
 *
 * Format: arkcontract={type}&{key1}={value1}&{key2}={value2}...
 *
 * This format is compatible with NArk and allows contracts to be
 * shared/imported across different Ark implementations.
 *
 * @example
 * ```typescript
 * const contract: Contract = {
 *   type: "vhtlc",
 *   params: { sender: "ab12...", receiver: "cd34...", ... },
 *   // ...
 * };
 *
 * const encoded = encodeArkContract(contract);
 * // "arkcontract=vhtlc&sender=ab12...&receiver=cd34...&..."
 * ```
 */
export declare function encodeArkContract(contract: Contract): string;
/**
 * Parsed result from decoding an arkcontract string.
 *
 * This is a low-level representation. For type-safe contract creation,
 * use `contractFromArkContract` or `contractFromArkContractWithAddress`
 * which validate params through the handler system.
 */
export interface ParsedArkContract {
    /** Contract type (e.g., "vhtlc", "default") */
    type: string;
    /** All key-value pairs from the string */
    data: Record<string, string>;
}
/**
 * Decode an arkcontract string into raw type and data.
 *
 * This is a low-level function that parses the URL-encoded format.
 * For creating typed Contract objects, use `contractFromArkContract`
 * or `contractFromArkContractWithAddress` instead.
 *
 * @param encoded - The arkcontract string
 * @returns Parsed type and key-value data
 * @throws If the string is not a valid arkcontract
 *
 * @example
 * ```typescript
 * const parsed = decodeArkContract("arkcontract=vhtlc&sender=ab12...");
 * // { type: "vhtlc", data: { sender: "ab12...", ... } }
 * ```
 */
export declare function decodeArkContract(encoded: string): ParsedArkContract;
/**
 * Create a Contract from an arkcontract string.
 *
 * This requires a handler to be registered for the contract type.
 *
 * @param encoded - The arkcontract string
 * @param options - Additional options for the contract
 * @returns A Contract object
 * @throws If the string is invalid or no handler exists for the type
 *
 * @example
 * ```typescript
 * const contract = contractFromArkContract(
 *   "arkcontract=vhtlc&sender=ab12...",
 *   {
 *     label: "Lightning Receive",
 *   }
 * );
 * ```
 */
export declare function contractFromArkContract(encoded: string, options?: {
    label?: string;
    state?: "active" | "inactive";
    expiresAt?: number;
    metadata?: Record<string, unknown>;
}): Omit<Contract, "script" | "address"> & {
    script?: string;
    address?: string;
};
/**
 * Create a full Contract with derived script and address.
 *
 * @param encoded - The arkcontract string
 * @param serverPubKey - Server public key (for address derivation)
 * @param addressPrefix - Address prefix (e.g., "tark" for testnet)
 * @param options - Additional options
 * @returns A complete Contract object
 */
export declare function contractFromArkContractWithAddress(encoded: string, serverPubKey: Uint8Array, addressPrefix: string, options?: {
    label?: string;
    state?: "active" | "inactive";
    expiresAt?: number;
    metadata?: Record<string, unknown>;
}): Contract;
/**
 * Check if a string is an arkcontract.
 */
export declare function isArkContract(str: string): boolean;
