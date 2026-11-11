// `async_hooks` shapes, for the modules a framework loads for diagnostics.
//
// The isolate exposes no promise hooks, so `createHook` subscribes to nothing
// and `AsyncResource` is a named scope rather than a traced one. What does work
// is the synchronous contract: `runInAsyncScope` calls through with the
// caller's `this`, which is how a content-type parser binds its completion.
//
// `AsyncLocalStorage.run` keeps its store for the synchronous body of the
// callback. A framework that relies on the store surviving an `await` would
// need real promise hooks; the store is restored when the callback returns,
// not when its promise settles.
export class AsyncResource {
  constructor(type, triggerAsyncId = 0) {
    this.type = type;
    this._triggerAsyncId = triggerAsyncId;
  }

  runInAsyncScope(fn, thisArg, ...args) {
    return fn.apply(thisArg, args);
  }

  bind(fn) {
    return (...args) => this.runInAsyncScope(fn, undefined, ...args);
  }

  emitDestroy() {
    return this;
  }

  asyncId() {
    return 0;
  }

  triggerAsyncId() {
    return this._triggerAsyncId;
  }
}

export class AsyncLocalStorage {
  constructor() {
    this._store = undefined;
  }

  getStore() {
    return this._store;
  }

  run(store, callback, ...args) {
    const previous = this._store;
    this._store = store;
    try {
      return callback(...args);
    } finally {
      this._store = previous;
    }
  }

  enterWith(store) {
    this._store = store;
  }

  exit(callback, ...args) {
    const previous = this._store;
    this._store = undefined;
    try {
      return callback(...args);
    } finally {
      this._store = previous;
    }
  }

  disable() {
    this._store = undefined;
  }
}

export function createHook() {
  return { enable() {}, disable() {} };
}

export const executionAsyncId = () => 0;
export const triggerAsyncId = () => 0;
export const executionAsyncResource = () => ({});

export default {
  AsyncResource,
  AsyncLocalStorage,
  createHook,
  executionAsyncId,
  triggerAsyncId,
  executionAsyncResource,
};
