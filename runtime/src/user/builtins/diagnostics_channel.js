// `diagnostics_channel`: publish/subscribe with nothing instrumented behind it.
//
// A library probes it (`hasSubscribers`, `channel(...).subscribe`) to decide
// whether to emit tracing data; answering honestly — no subscribers — keeps
// that code on its cheap path. `publish` reaches whoever subscribed, so a test
// that subscribes still sees what the app publishes.
const channels = new Map();

export class Channel {
  constructor(name) {
    this.name = name;
    this._subscribers = new Set();
  }

  get hasSubscribers() {
    return this._subscribers.size > 0;
  }

  subscribe(callback) {
    this._subscribers.add(callback);
    return { unsubscribe: () => this._subscribers.delete(callback) };
  }

  unsubscribe(callback) {
    this._subscribers.delete(callback);
  }

  publish(message) {
    for (const callback of [...this._subscribers]) {
      try {
        callback(message);
      } catch {
        // A subscriber's failure is its own; an instrumentation point must not
        // change the behavior of what it instruments.
      }
    }
  }
}

export function channel(name) {
  const key = String(name);
  let found = channels.get(key);
  if (!found) {
    found = new Channel(key);
    channels.set(key, found);
  }
  return found;
}

export function hasSubscribers(name) {
  return channel(name).hasSubscribers;
}

export function subscribe(name, callback) {
  return channel(name).subscribe(callback);
}

export function unsubscribe(name, callback) {
  return channel(name).unsubscribe(callback);
}

export default { Channel, channel, hasSubscribers, subscribe, unsubscribe };
