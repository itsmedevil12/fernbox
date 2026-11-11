// The `events` builtin: the EventEmitter polyfill esbuild inlines. One copy is
// shared by the stream base, the `net` shim, and the `http` module, so an
// `instanceof EventEmitter` check holds wherever a framework makes one.
import events from "events";

export const EventEmitter = events.EventEmitter;
export const once = events.once;
export const defaultMaxListeners = events.defaultMaxListeners;
export const listenerCount = events.listenerCount;
export default events;