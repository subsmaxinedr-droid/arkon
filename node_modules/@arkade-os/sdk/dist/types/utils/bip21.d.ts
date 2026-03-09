export interface BIP21Params {
    address?: string;
    amount?: number;
    label?: string;
    message?: string;
    ark?: string;
    sp?: string;
    [key: string]: string | number | undefined;
}
export interface BIP21ParseResult {
    originalString: string;
    params: BIP21Params;
}
export declare enum BIP21Error {
    INVALID_URI = "Invalid BIP21 URI",
    INVALID_ADDRESS = "Invalid address"
}
export declare class BIP21 {
    static create(params: BIP21Params): string;
    static parse(uri: string): BIP21ParseResult;
}
