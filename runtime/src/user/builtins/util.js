// The `util` builtin, straight from the browserify polyfill. Dependencies
// imported at module load reach for `util.inherits`, `util.format`, and
// `util.inspect`; the default export is the CommonJS module object itself, so
// `require("util")` looks like Node's.
import util from "util";

export const inherits = util.inherits;
export const inspect = util.inspect;
export const format = util.format;
export const formatWithOptions = util.formatWithOptions;
export const promisify = util.promisify;
export const callbackify = util.callbackify;
export const deprecate = util.deprecate;
export const debuglog = util.debuglog;
export const isDeepStrictEqual = util.isDeepStrictEqual;
export const types = util.types ?? {};
// The codecs are installed on the global by the boot banner; Node exposes the
// same classes from `util`, and dependency code may import either spelling.
export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;

export default util;
