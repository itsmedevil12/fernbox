// The `stream` builtin: Node's stream surface, backed by readable-stream via
// the browserify polyfill esbuild inlines at build time. Exposing it as a
// builtin means the `http` module's IncomingMessage/ServerResponse and an app's
// own `require("stream")` share one Readable/Writable, so `instanceof` and
// `Buffer.isBuffer` agree across the boundary instead of comparing two copies.
import Stream from "stream";

export const Readable = Stream.Readable;
export const Writable = Stream.Writable;
export const Duplex = Stream.Duplex;
export const Transform = Stream.Transform;
export const PassThrough = Stream.PassThrough;
export const finished = Stream.finished;
export const pipeline = Stream.pipeline;
export { Stream };
export default Stream;