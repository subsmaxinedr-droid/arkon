"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeAmount = void 0;
/**
 * FeeAmount is a wrapper around a number that represents a fee amount in satoshis floating point.
 * @param value - The fee amount in floating point.
 * @method satoshis - Returns the fee amount in satoshis as a integer.
 * @example
 * const fee = new FeeAmount(1.23456789);
 * console.log(fee.value); // 1.23456789
 * console.log(fee.satoshis); // 2
 */
class FeeAmount {
    constructor(value) {
        this.value = value;
    }
    get satoshis() {
        return this.value ? Math.ceil(this.value) : 0;
    }
    add(other) {
        return new FeeAmount(this.value + other.value);
    }
}
exports.FeeAmount = FeeAmount;
FeeAmount.ZERO = new FeeAmount(0);
