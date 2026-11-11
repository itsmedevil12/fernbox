// The `net` builtin: the shapes a framework touches, not a transport.
//
// There are no sockets in the sandbox. The daemon owns the only listening
// socket a run may have, and forwards whole requests to `http`; a raw TCP
// connection is not something this realm can open. What is here is what code
// reaches for structurally: `net.Server` (which `http.Server` extends),
// `net.Socket` (the `req.socket` stand-in with the address fields middleware
// reads), and the address-family predicates, which are pure functions.
import events from "events";

const { EventEmitter } = events;

/** A socket-shaped view of one connection the daemon accepted for us. There is
 * no byte pipe behind it: `destroy` answers the `close` a middleware waits for,
 * and `write` refuses rather than pretending bytes went somewhere. */
export class Socket extends EventEmitter {
  constructor(options = {}) {
    super();
    this.connecting = false;
    this.destroyed = false;
    this.readable = true;
    // An accepted connection is writable until it closes. Frameworks gate their
    // response on this (`ctx.writable` in Koa), so a stand-in that said false
    // would leave the response silently unsent.
    this.writable = true;
    this.pending = false;
    this.remoteAddress = options.remoteAddress ?? "127.0.0.1";
    this.remoteFamily = "IPv4";
    this.remotePort = options.remotePort ?? 0;
    this.localAddress = options.localAddress ?? "127.0.0.1";
    this.localPort = options.localPort ?? 0;
    this.bytesRead = 0;
    this.bytesWritten = 0;
  }

  address() {
    return { address: this.localAddress, family: "IPv4", port: this.localPort };
  }

  setTimeout(ms, callback) {
    if (typeof callback === "function") this.once("timeout", callback);
    return this;
  }

  setNoDelay() {
    return this;
  }

  setKeepAlive() {
    return this;
  }

  ref() {
    return this;
  }

  unref() {
    return this;
  }

  destroy(error) {
    if (this.destroyed) return this;
    this.destroyed = true;
    this.readable = false;
    this.writable = false;
    if (error) this.emit("error", error);
    this.emit("close", Boolean(error));
    return this;
  }

  end(data) {
    if (data !== undefined) this.write(data);
    if (this.destroyed) return this;
    this.destroyed = true;
    this.readable = false;
    this.writable = false;
    this.emit("finish");
    this.emit("close", false);
    return this;
  }

  write() {
    throw new Error("ERR_NET_UNSUPPORTED: the sandbox has no raw sockets; use http.request");
  }
}

/** The base class `http.Server` extends. Its `listen` is overridden there,
 * because listening is a grant to the run's `http` surface, not a net call. */
export class Server extends EventEmitter {
  constructor(options, connectionListener) {
    super();
    if (typeof options === "function") {
      connectionListener = options;
      options = undefined;
    }
    if (typeof connectionListener === "function") this.on("connection", connectionListener);
    this.listening = false;
    this.maxConnections = undefined;
    this.connections = 0;
    this.allowHalfOpen = Boolean(options && options.allowHalfOpen);
  }

  listen() {
    throw new Error("ERR_NET_UNSUPPORTED: net.Server cannot listen in the sandbox; use http.createServer");
  }

  close(callback) {
    this.listening = false;
    if (typeof callback === "function") process.nextTick(() => callback(null));
    process.nextTick(() => this.emit("close"));
    return this;
  }

  address() {
    return null;
  }

  getConnections(callback) {
    process.nextTick(() => callback(null, this.connections));
  }

  ref() {
    return this;
  }

  unref() {
    return this;
  }
}

export function createServer(...args) {
  return new Server(...args);
}

export function connect() {
  throw new Error("ERR_NET_UNSUPPORTED: the sandbox has no outbound TCP; use http.request");
}

export const createConnection = connect;

export function isIPv4(input) {
  const parts = String(input).split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (part.length > 1 && part[0] === "0") return false;
    return Number(part) <= 255;
  });
}

export function isIPv6(input) {
  const text = String(input);
  // A pragmatic check, not a full RFC parser: at least two colons, only hex
  // digits, colons, and at most one embedded IPv4 tail.
  if (!text.includes(":")) return false;
  if (text.split(":").length < 3 && !text.includes("::")) return false;
  return /^[0-9a-fA-F:.]+$/.test(text) && !text.includes(":::");
}

export function isIP(input) {
  if (isIPv4(input)) return 4;
  if (isIPv6(input)) return 6;
  return 0;
}

export default { Socket, Server, createServer, connect, createConnection, isIP, isIPv4, isIPv6 };
