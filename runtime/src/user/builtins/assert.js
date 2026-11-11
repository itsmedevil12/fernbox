// The `assert` builtin. Node's module is callable — `assert(value, message)` —
// and the polyfill keeps that shape, so the default export is the function
// with its methods, not a namespace.
import assert from "assert";

export const ok = assert.ok;
export const equal = assert.equal;
export const notEqual = assert.notEqual;
export const strictEqual = assert.strictEqual;
export const notStrictEqual = assert.notStrictEqual;
export const deepEqual = assert.deepEqual;
export const deepStrictEqual = assert.deepStrictEqual;
export const throws = assert.throws;
export const doesNotThrow = assert.doesNotThrow;
export const fail = assert.fail;
export const AssertionError = assert.AssertionError;

export default assert;
