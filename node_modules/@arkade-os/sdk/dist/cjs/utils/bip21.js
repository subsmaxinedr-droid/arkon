"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BIP21 = exports.BIP21Error = void 0;
var BIP21Error;
(function (BIP21Error) {
    BIP21Error["INVALID_URI"] = "Invalid BIP21 URI";
    BIP21Error["INVALID_ADDRESS"] = "Invalid address";
})(BIP21Error || (exports.BIP21Error = BIP21Error = {}));
class BIP21 {
    static create(params) {
        const { address, ...options } = params;
        // Build query string
        const queryParams = {};
        for (const [key, value] of Object.entries(options)) {
            if (value === undefined)
                continue;
            if (key === "amount") {
                if (!isFinite(value)) {
                    console.warn("Invalid amount");
                    continue;
                }
                if (value < 0) {
                    continue;
                }
                queryParams[key] = value;
            }
            else if (key === "ark") {
                // Validate ARK address format
                if (typeof value === "string" &&
                    (value.startsWith("ark") || value.startsWith("tark"))) {
                    queryParams[key] = value;
                }
                else {
                    console.warn("Invalid ARK address format");
                }
            }
            else if (key === "sp") {
                // Validate Silent Payment address format (placeholder)
                if (typeof value === "string" && value.startsWith("sp")) {
                    queryParams[key] = value;
                }
                else {
                    console.warn("Invalid Silent Payment address format");
                }
            }
            else if (typeof value === "string" || typeof value === "number") {
                queryParams[key] = value;
            }
        }
        const query = Object.keys(queryParams).length > 0
            ? "?" +
                new URLSearchParams(Object.fromEntries(Object.entries(queryParams).map(([k, v]) => [
                    k,
                    String(v),
                ]))).toString()
            : "";
        return `bitcoin:${address ? address.toLowerCase() : ""}${query}`;
    }
    static parse(uri) {
        if (!uri.toLowerCase().startsWith("bitcoin:")) {
            throw new Error(BIP21Error.INVALID_URI);
        }
        // Remove bitcoin: prefix, preserving case of the rest
        const withoutPrefix = uri.slice(uri.toLowerCase().indexOf("bitcoin:") + 8);
        const [address, query] = withoutPrefix.split("?");
        const params = {};
        if (address) {
            params.address = address.toLowerCase();
        }
        if (query) {
            const queryParams = new URLSearchParams(query);
            for (const [key, value] of queryParams.entries()) {
                if (!value)
                    continue;
                if (key === "amount") {
                    const amount = Number(value);
                    if (!isFinite(amount)) {
                        continue;
                    }
                    if (amount < 0) {
                        continue;
                    }
                    params[key] = amount;
                }
                else if (key === "ark") {
                    // Validate ARK address format
                    if (value.startsWith("ark") || value.startsWith("tark")) {
                        params[key] = value;
                    }
                    else {
                        console.warn("Invalid ARK address format");
                    }
                }
                else if (key === "sp") {
                    // Validate Silent Payment address format (placeholder)
                    if (value.startsWith("sp")) {
                        params[key] = value;
                    }
                    else {
                        console.warn("Invalid Silent Payment address format");
                    }
                }
                else {
                    params[key] = value;
                }
            }
        }
        return {
            originalString: uri,
            params,
        };
    }
}
exports.BIP21 = BIP21;
