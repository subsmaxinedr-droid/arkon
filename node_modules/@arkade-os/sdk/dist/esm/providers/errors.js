export class ArkError extends Error {
    constructor(code, message, name, metadata) {
        super(message);
        this.code = code;
        this.message = message;
        this.name = name;
        this.metadata = metadata;
    }
}
/**
 * Try to convert an error to an ArkError class, returning undefined if the error is not an ArkError
 * @param error - The error to parse
 * @returns The parsed ArkError, or undefined if the error is not an ArkError
 */
export function maybeArkError(error) {
    try {
        if (!(error instanceof Error))
            return undefined;
        const decoded = JSON.parse(error.message);
        if (!("details" in decoded))
            return undefined;
        if (!Array.isArray(decoded.details))
            return undefined;
        // search for a valid details object with the correct type
        for (const details of decoded.details) {
            if (!("@type" in details))
                continue;
            const type = details["@type"];
            if (type !== "type.googleapis.com/ark.v1.ErrorDetails")
                continue;
            if (!("code" in details))
                continue;
            const code = details.code;
            if (!("message" in details))
                continue;
            const message = details.message;
            if (!("name" in details))
                continue;
            const name = details.name;
            let metadata;
            if ("metadata" in details && isMetadata(details.metadata)) {
                metadata = details.metadata;
            }
            return new ArkError(code, message, name, metadata);
        }
        return undefined;
    }
    catch (e) {
        return undefined;
    }
}
function isMetadata(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
