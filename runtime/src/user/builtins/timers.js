// The `timers` builtin: the same scheduler the globals use, reachable by name
// for dependencies that import it instead of using `setTimeout`.
const bind = (name) => (...args) => globalThis[name](...args);

export const setTimeout = bind("setTimeout");
export const clearTimeout = bind("clearTimeout");
export const setInterval = bind("setInterval");
export const clearInterval = bind("clearInterval");
export const setImmediate = bind("setImmediate");
export const clearImmediate = bind("clearImmediate");

function abortError() {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  err.code = "ABORT_ERR";
  return err;
}

function guard(signal) {
  if (signal?.aborted) throw signal.reason ?? abortError();
}

// Node's `timers/promises`: the same scheduler, promise-shaped. Abort signals
// are honoured when the caller passes one; the isolate has no AbortController
// of its own, but a dependency that got one in crosses no boundary here.
const promises = {
  setTimeout(delay = 0, value, options = {}) {
    return new Promise((resolve, reject) => {
      const signal = options?.signal;
      try {
        guard(signal);
      } catch (err) {
        reject(err);
        return;
      }
      const onAbort = () => {
        globalThis.clearTimeout(id);
        reject(signal.reason ?? abortError());
      };
      const id = globalThis.setTimeout(() => {
        signal?.removeEventListener?.("abort", onAbort);
        resolve(value);
      }, delay);
      signal?.addEventListener?.("abort", onAbort, { once: true });
    });
  },

  setImmediate(value, options = {}) {
    return promises.setTimeout(0, value, options);
  },

  // An async iterator over interval values, the shape Node returns. The queue
  // is finite only because the iterator's consumer stops it: `return` clears
  // the underlying interval.
  setInterval(delay = 0, value, options = {}) {
    const signal = options?.signal;
    const queue = [];
    let wake = null;
    let stopped = false;
    const id = globalThis.setInterval(() => {
      if (wake) {
        const resume = wake;
        wake = null;
        resume({ value, done: false });
      } else {
        queue.push(value);
      }
    }, delay);
    const stop = () => {
      if (stopped) return;
      stopped = true;
      globalThis.clearInterval(id);
      signal?.removeEventListener?.("abort", stop);
      if (wake) {
        const resume = wake;
        wake = null;
        resume({ value: undefined, done: true });
      }
    };
    signal?.addEventListener?.("abort", stop, { once: true });
    const iterator = {
      next() {
        if (queue.length > 0) return Promise.resolve({ value: queue.shift(), done: false });
        if (stopped) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => {
          wake = resolve;
        });
      },
      return() {
        stop();
        return Promise.resolve({ value: undefined, done: true });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
    return iterator;
  },

  scheduler: {
    wait(delay, options = {}) {
      return promises.setTimeout(delay, undefined, options);
    },
    async yield() {
      await Promise.resolve();
    },
  },
};

export { promises };

export default {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  setImmediate,
  clearImmediate,
  promises,
};
