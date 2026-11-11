// The `buffer` builtin: the feross Buffer polyfill esbuild inlines. The same
// class is installed as the global `Buffer`, so a framework's `Buffer.isBuffer`
// sees the bytes the `http` module pushes, not a foreign copy.
import buffer from "buffer";

export const Buffer = buffer.Buffer;
export const SlowBuffer = buffer.SlowBuffer;
export const INSPECT_MAX_BYTES = buffer.INSPECT_MAX_BYTES;
export const kMaxLength = buffer.kMaxLength;

// Node's limits. `MAX_STRING_LENGTH` is what a string can hold on a 64-bit
// build; libraries read it to size a chunk (thread-stream does, at import).
export const constants = {
  MAX_LENGTH: buffer.kMaxLength,
  MAX_STRING_LENGTH: 536870888,
  MAX_STRING_LENGTH_IN_BYTES: 536870888,
};

export default buffer;