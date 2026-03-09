export declare class ArkError extends Error {
    readonly code: number;
    readonly message: string;
    readonly name: string;
    readonly metadata?: Record<string, string> | undefined;
    constructor(code: number, message: string, name: string, metadata?: Record<string, string> | undefined);
}
/**
 * Try to convert an error to an ArkError class, returning undefined if the error is not an ArkError
 * @param error - The error to parse
 * @returns The parsed ArkError, or undefined if the error is not an ArkError
 */
export declare function maybeArkError(error: any): ArkError | undefined;
