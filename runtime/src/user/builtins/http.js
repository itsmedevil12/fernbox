// The `http` builtin: Node's server and client surface over the sandbox's one
// listening socket and its controlled fetch.
//
// There is no socket here. The daemon owns the real one, accepts a connection,
// buffers the whole request, and forwards it across the boundary as base64
// bytes; `fernbox.http.listen` registers the dispatch built below, and
// `fernbox.http.respond` hands a finished response back the same way. So this
// file is pure parsing, stream shaping, and serialization in the user realm —
// it never holds a privileged object, and every byte crosses as a string.
//
// The classes are the ones frameworks actually build on: `IncomingMessage` is
// a `Readable` (so `body-parser` can pipe it), `ServerResponse` is a `Writable`
// (so middleware can pipe into it), and `Server` extends `net.Server` and emits
// `request`. The gate serves one request per connection and cannot stream a
// half-written response, so a response is buffered until `end` and framed with
// an exact `Content-Length`; chunked responses, keep-alive, and raw sockets are
// the pieces that are deliberately absent.
import events from "events";
import stream from "stream";
import net from "./net.js";
import urlModule from "./url.js";

const { EventEmitter } = events;
const { Readable, Writable } = stream;

const api = () => globalThis.fernbox.http;

// The isolate has no ambient `Buffer`, `atob`, or `TextEncoder`, so the codecs
// are hand-rolled here the way `/bin/npm.js` rolls its own. Bytes cross the
// boundary as base64; text is UTF-8.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

function decodeBase64(text) {
  const values = [];
  for (const ch of text) {
    if (ch === "=") break;
    const value = B64.indexOf(ch);
    if (value >= 0) values.push(value);
  }
  const bytes = new Uint8Array(((values.length * 6) / 8) | 0);
  let acc = 0;
  let bits = 0;
  let at = 0;
  for (const value of values) {
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[at++] = (acc >> bits) & 0xff;
    }
  }
  return bytes;
}

function encodeUtf8(text) {
  const bytes = [];
  let i = 0;
  while (i < text.length) {
    const c = text.codePointAt(i++);
    if (c > 0xffff) i++;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000)
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
  }
  return Uint8Array.from(bytes);
}

function decodeUtf8(bytes) {
  let i = 0;
  const cont = () => {
    if (i >= bytes.length) throw new Error("truncated utf-8");
    const b = bytes[i++];
    if ((b & 0xc0) !== 0x80) throw new Error("bad utf-8 continuation byte");
    return b & 0x3f;
  };
  const points = [];
  while (i < bytes.length) {
    const b = bytes[i++];
    let c;
    if (b < 0x80) c = b;
    else if ((b & 0xe0) === 0xc0) c = ((b & 0x1f) << 6) | cont();
    else if ((b & 0xf0) === 0xe0) c = ((b & 0x0f) << 12) | (cont() << 6) | cont();
    else if ((b & 0xf8) === 0xf0)
      c = ((b & 0x07) << 18) | (cont() << 12) | (cont() << 6) | cont();
    else throw new Error("bad utf-8 lead byte");
    if (c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) throw new Error("invalid utf-8 code point");
    points.push(c);
  }
  let out = "";
  for (let j = 0; j < points.length; j += 4096)
    out += String.fromCodePoint(...points.slice(j, j + 4096));
  return out;
}

// Headers are ISO-8859-1 on the wire, so a byte-per-char decode is honest here
// and never throws on a non-UTF-8 value the way a validating decoder would.
function latin1(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function toBytes(chunk) {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return chunk;
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  return encodeUtf8(String(chunk));
}

function concat(chunks) {
  let len = 0;
  for (const c of chunks) len += c.length;
  const out = Buffer.alloc(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** Node's complete status table. `statusMessage` falls back to this. */
export const STATUS_CODES = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  208: "Already Reported",
  226: "IM Used",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Payload Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a Teapot",
  421: "Misdirected Request",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  509: "Bandwidth Limit Exceeded",
  510: "Not Extended",
  511: "Network Authentication Required",
};

export const METHODS = [
  "ACL", "BIND", "CHECKOUT", "CONNECT", "COPY", "DELETE", "GET", "HEAD", "LINK", "LOCK",
  "M-SEARCH", "MERGE", "MKACTIVITY", "MKCALENDAR", "MKCOL", "MOVE", "NOTIFY", "OPTIONS",
  "PATCH", "POST", "PROPFIND", "PROPPATCH", "PURGE", "PUT", "REBIND", "REPORT", "SEARCH",
  "SOURCE", "SUBSCRIBE", "TRACE", "UNBIND", "UNLINK", "UNLOCK", "UNSUBSCRIBE",
];

/// The gate refuses a header block past 64 KB, so that is the truthful ceiling.
export const maxHeaderSize = 64 * 1024;

const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const INVALID_HEADER_VALUE = /[\0-\x08\x0A-\x1F\x7F]/;

export function validateHeaderName(name) {
  const text = String(name);
  if (!HEADER_NAME.test(text)) {
    const err = new TypeError(`Invalid HTTP header name: ${JSON.stringify(text)}`);
    err.code = "ERR_INVALID_HTTP_TOKEN";
    throw err;
  }
  return text;
}

export function validateHeaderValue(name, value) {
  if (value === undefined) {
    const err = new TypeError(`Invalid HTTP header value for ${name}`);
    err.code = "ERR_HTTP_INVALID_HEADER_VALUE";
    throw err;
  }
  if (INVALID_HEADER_VALUE.test(String(value))) {
    const err = new TypeError(`Invalid character in header content ["${name}"]`);
    err.code = "ERR_INVALID_CHAR";
    throw err;
  }
  return value;
}

/** Split a buffered request into its parts. The daemon already framed it by
 * `Content-Length`, so whatever follows the blank line is the whole body. */
function parseRequest(bytes) {
  let sep = -1;
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) {
      sep = i;
      break;
    }
  }
  const headEnd = sep < 0 ? bytes.length : sep;
  const head = latin1(bytes.subarray(0, headEnd));
  const body = sep < 0 ? Buffer.alloc(0) : Buffer.from(bytes.subarray(sep + 4));
  const lines = head.split("\r\n");
  const requestLine = (lines[0] ?? "").split(" ");
  const headers = {};
  const headersDistinct = {};
  const rawHeaders = [];
  for (let i = 1; i < lines.length; i++) {
    const colon = lines[i].indexOf(":");
    if (colon < 0) continue;
    const rawName = lines[i].slice(0, colon).trim();
    const value = lines[i].slice(colon + 1).trim();
    if (!rawName) continue;
    const name = rawName.toLowerCase();
    rawHeaders.push(rawName, value);
    (headersDistinct[name] ??= []).push(value);
    if (name === "set-cookie") {
      (headers[name] ??= []).push(value);
    } else if (name in headers) {
      headers[name] = `${headers[name]}, ${value}`;
    } else {
      headers[name] = value;
    }
  }
  return {
    method: requestLine[0] ?? "GET",
    url: requestLine[1] ?? "/",
    httpVersion: (requestLine[2] ?? "HTTP/1.1").replace(/^HTTP\//, ""),
    headers,
    headersDistinct,
    rawHeaders,
    body,
  };
}

/** The request side. A real `Readable`, because middleware pipes it: the whole
 * body is buffered by the gate before dispatch, then pushed once and ended. */
export class IncomingMessage extends Readable {
  constructor(socket, parsed, response = {}) {
    super({ autoDestroy: true });
    this.socket = socket ?? new net.Socket();
    this.connection = this.socket;
    this.httpVersion = parsed?.httpVersion ?? "1.1";
    this.httpVersionMajor = Number(this.httpVersion.split(".")[0]) || 1;
    this.httpVersionMinor = Number(this.httpVersion.split(".")[1]) || 1;
    this.complete = false;
    this.aborted = false;
    this.upgrade = false;
    this.method = response.statusCode === undefined ? parsed?.method : undefined;
    this.url = response.statusCode === undefined ? parsed?.url : "";
    this.headers = parsed?.headers ?? {};
    this.headersDistinct = parsed?.headersDistinct ?? {};
    this.rawHeaders = parsed?.rawHeaders ?? [];
    this.trailers = {};
    this.rawTrailers = [];
    this.statusCode = response.statusCode;
    this.statusMessage = response.statusMessage;
    this._bodyBytes = parsed?.body ?? Buffer.alloc(0);
    // A convenience Node does not have: the whole body as text, for the JSON
    // services this was first built for. Binary bodies still arrive as bytes on
    // 'data'; a body that is not valid UTF-8 falls back to latin1 rather than
    // throwing, so reading `.body` never costs a request.
    try {
      this.body = decodeUtf8(this._bodyBytes);
    } catch {
      this.body = latin1(this._bodyBytes);
    }
    // Delivered on the next tick, so a handler has its synchronous turn to
    // attach 'data'/'end' listeners before the stream flows, as under Node.
    process.nextTick(() => {
      if (this.destroyed) return;
      if (this._bodyBytes.length > 0) this.push(Buffer.from(this._bodyBytes));
      this.complete = true;
      this.push(null);
    });
  }

  _read() {}

  setTimeout(ms, callback) {
    if (typeof callback === "function") this.once("timeout", callback);
    return this;
  }
}

/** A Writable that frames the response into one buffer and hands it to the
 * chokepoint. `write` appends; `end` is what makes it cross the boundary. */
export class ServerResponse extends Writable {
  constructor(req, id) {
    super({ autoDestroy: false });
    this.req = req;
    this._id = id;
    this.statusCode = 200;
    this.statusMessage = undefined;
    this.headersSent = false;
    this.sendDate = true;
    this.socket = req.socket;
    this.connection = this.socket;
    this.shouldKeepAlive = false;
    this.useChunkedEncodingByDefault = false;
    this.chunkedEncoding = false;
    this.strictContentLength = false;
    this._headers = new Map();
    this._headerWritten = false;
    this._chunks = [];
    this._bytes = 0;
    this._responded = false;
  }

  setHeader(name, value) {
    if (this.headersSent) {
      const err = new Error("Cannot set headers after they are sent to the client");
      err.code = "ERR_HTTP_HEADERS_SENT";
      throw err;
    }
    const key = validateHeaderName(name).toLowerCase();
    validateHeaderValue(name, value);
    const stored = Array.isArray(value)
      ? value.map((item) => validateHeaderValue(name, item))
      : value;
    this._headers.set(key, { name: String(name), value: stored });
    return this;
  }

  getHeader(name) {
    return this._headers.get(String(name).toLowerCase())?.value;
  }

  getHeaderNames() {
    return [...this._headers.keys()];
  }

  getRawHeaderNames() {
    return [...this._headers.values()].map((entry) => entry.name);
  }

  getHeaders() {
    const out = {};
    for (const [key, entry] of this._headers) out[key] = entry.value;
    return out;
  }

  hasHeader(name) {
    return this._headers.has(String(name).toLowerCase());
  }

  removeHeader(name) {
    if (this.headersSent) {
      const err = new Error("Cannot remove headers after they are sent to the client");
      err.code = "ERR_HTTP_HEADERS_SENT";
      throw err;
    }
    this._headers.delete(String(name).toLowerCase());
  }

  appendHeader(name, value) {
    const existing = this.getHeader(name);
    if (existing === undefined) return this.setHeader(name, value);
    const merged = Array.isArray(existing)
      ? [...existing, ...(Array.isArray(value) ? value : [value])]
      : [existing, ...(Array.isArray(value) ? value : [value])];
    return this.setHeader(name, merged);
  }

  writeHead(statusCode, reason, headers) {
    if (this.headersSent) {
      const err = new Error("Cannot write headers after they are sent to the client");
      err.code = "ERR_HTTP_HEADERS_SENT";
      throw err;
    }
    this.statusCode = statusCode;
    if (typeof reason === "string") {
      this.statusMessage = reason;
    } else {
      headers = reason;
    }
    if (Array.isArray(headers)) {
      for (let i = 0; i + 1 < headers.length; i += 2) this.setHeader(headers[i], headers[i + 1]);
    } else if (headers && typeof headers === "object") {
      for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    }
    this._headerWritten = true;
    return this;
  }

  flushHeaders() {
    // The gate forwards one finished response per request, so there is nothing
    // to flush yet. Marking them sent would make the next setHeader throw for a
    // response that has not actually left the sandbox.
  }

  writeContinue() {}
  writeProcessing() {}

  _write(chunk, _encoding, callback) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this._chunks.push(bytes);
    this._bytes += bytes.length;
    callback();
  }

  _final(callback) {
    this._flush();
    callback();
  }

  _flush() {
    if (this._responded) return;
    this._responded = true;
    const raw = serialize(this);
    this.headersSent = true;
    api().respond(String(this._id), encodeBase64(raw));
    // Node emits 'close' once the response is finished; middleware that waits
    // for it should not wait forever behind a connection the gate closed.
    process.nextTick(() => this.emit("close"));
  }
}

/** Node keeps `OutgoingMessage` as the base of `ServerResponse`; code that
 * checks `instanceof http.OutgoingMessage` gets the same object here. */
export const OutgoingMessage = ServerResponse;

// Frame the response: status line, the caller's headers, then the ones the
// gate's byte-pump needs — an exact Content-Length and Connection: close.
function serialize(res) {
  const status = res.statusCode || 200;
  const message = res.statusMessage || STATUS_CODES[status] || "Unknown";
  const body = concat(res._chunks);

  const headers = new Map();
  for (const [key, entry] of res._headers) headers.set(key, entry);
  // Chunked framing is not something the gate can write; the body is complete
  // here, so an exact length always wins.
  headers.delete("transfer-encoding");
  if (!headers.has("content-length")) {
    headers.set("content-length", { name: "Content-Length", value: String(body.length) });
  }
  if (res.sendDate && !headers.has("date")) {
    headers.set("date", { name: "Date", value: new Date().toUTCString() });
  }
  headers.set("connection", { name: "Connection", value: "close" });

  let head = `HTTP/1.1 ${status} ${message}\r\n`;
  for (const [key, entry] of headers) {
    if (entry.value === undefined || entry.value === null) continue;
    if (Array.isArray(entry.value)) {
      if (key === "set-cookie") {
        for (const item of entry.value) head += `${entry.name}: ${item}\r\n`;
      } else {
        head += `${entry.name}: ${entry.value.join(", ")}\r\n`;
      }
    } else {
      head += `${entry.name}: ${entry.value}\r\n`;
    }
  }
  head += "\r\n";
  const headBytes = Buffer.from(head, "latin1");
  const out = Buffer.alloc(headBytes.length + body.length);
  out.set(headBytes, 0);
  out.set(body, headBytes.length);
  return out;
}

// The dispatch core calls once per forwarded request. It owns the id, so it is
// also the one place that guarantees an answer: a handler that throws still
// gets a 500 rather than leaving the daemon waiting on a request that never
// resolves.
function makeDispatch(server) {
  return (requestJson) => {
    let id;
    let res;
    try {
      const frame = JSON.parse(requestJson);
      id = frame.id;
      const parsed = parseRequest(decodeBase64(frame.raw_b64));
      const socket = new net.Socket({ localPort: server._port ?? 0 });
      const req = new IncomingMessage(socket, parsed);
      res = new ServerResponse(req, id);
      server.emit("request", req, res);
    } catch {
      if (res && !res.writableEnded) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      } else if (id !== undefined) {
        // The request could not be shaped into a handler call at all; answer
        // through the same chokepoint rather than dropping the connection.
        const fallback = new ServerResponse(
          { socket: new net.Socket() },
          id,
        );
        fallback.statusCode = 500;
        fallback.end("Internal Server Error");
      }
    }
  };
}

/** Node's HTTP server: a `net.Server` whose listen is the run's granted port,
 * and whose `request` event is what frameworks register their app with. */
export class Server extends net.Server {
  constructor(options, requestListener) {
    super();
    if (typeof options === "function") {
      requestListener = options;
      options = undefined;
    }
    if (typeof requestListener === "function") this.on("request", requestListener);
    this.timeout = 0;
    this.keepAliveTimeout = 5000;
    this.headersTimeout = 60000;
    this.requestTimeout = 300000;
    this.maxHeadersCount = 2000;
    this._port = null;
  }

  // Node's listen takes (port[, host][, backlog][, callback]) and also an
  // options object. The host and backlog are the daemon's to decide; the grant
  // is a port, so anything else is accepted and ignored.
  listen(...args) {
    let port;
    let callback;
    for (const arg of args) {
      if (typeof arg === "function") callback = arg;
      else if (typeof arg === "number") port = arg;
      else if (typeof arg === "string" && /^\d+$/.test(arg)) port = Number(arg);
      else if (arg && typeof arg === "object" && arg.port !== undefined) port = Number(arg.port);
    }
    if (port === undefined) throw new Error("listen needs a port");
    api().listen(String(port), makeDispatch(this));
    this._port = port;
    this.listening = true;
    process.nextTick(() => {
      this.emit("listening");
      if (typeof callback === "function") callback();
    });
    return this;
  }

  close(callback) {
    if (!this.listening) {
      if (typeof callback === "function") process.nextTick(() => callback(new Error("Server is not running")));
      return this;
    }
    api().close();
    this.listening = false;
    process.nextTick(() => {
      this.emit("close");
      if (typeof callback === "function") callback();
    });
    return this;
  }

  address() {
    return this.listening
      ? { address: "127.0.0.1", family: "IPv4", port: this._port }
      : null;
  }

  setTimeout(msecs, callback) {
    this.timeout = msecs;
    if (typeof callback === "function") this.once("timeout", callback);
    return this;
  }

  closeAllConnections() {}
  closeIdleConnections() {}
}

export function createServer(...args) {
  // createServer([options], handler): the handler is the last function given.
  return new Server(...args);
}

// --- the client surface ------------------------------------------------------
//
// There is no outbound socket either. `request` builds the same options Node
// takes and performs one controlled fetch when the request ends; the response
// is shaped into an `IncomingMessage` so `on('response')` code reads the way it
// does under Node. Binary request bodies are sent as text; the fetch chokepoint
// is string-valued, so an app that uploads bytes needs base64 itself.

export class Agent {
  constructor(options = {}) {
    this.options = options;
    this.keepAlive = Boolean(options.keepAlive);
    this.maxSockets = options.maxSockets ?? Infinity;
    this.maxFreeSockets = options.maxFreeSockets ?? 256;
    this.sockets = {};
    this.freeSockets = {};
    this.requests = {};
  }

  destroy() {}
}

export const globalAgent = new Agent();

function normalizeClientOptions(input) {
  const options = { ...input };
  if (typeof input === "string") {
    const parsed = new urlModule.URL(input);
    options.protocol = parsed.protocol;
    options.hostname = parsed.hostname;
    options.port = parsed.port || undefined;
    options.path = `${parsed.pathname}${parsed.search}`;
    if (parsed.username || parsed.password) {
      options.auth = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
    }
  }
  return options;
}

function clientUrl(options) {
  const protocol = options.protocol || "http:";
  let host = options.hostname || options.host || "localhost";
  let port = options.port;
  if (!options.hostname && typeof host === "string" && host.includes(":")) {
    const [name, maybePort] = host.split(":");
    host = name;
    port = port ?? maybePort;
  }
  let path = options.path || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  return `${protocol}//${host}${port ? `:${port}` : ""}${path}`;
}

export class ClientRequest extends Writable {
  constructor(options, callback) {
    super({ autoDestroy: false });
    this._options = normalizeClientOptions(options);
    if (typeof callback === "function") this.once("response", callback);
    this.method = String(this._options.method || "GET").toUpperCase();
    this.path = this._options.path || "/";
    this.host = this._options.hostname || this._options.host || "localhost";
    this.protocol = this._options.protocol || "http:";
    this.agent = this._options.agent ?? globalAgent;
    this.aborted = false;
    this.finished = false;
    this.headers = {};
    for (const [name, value] of Object.entries(this._options.headers ?? {})) {
      if (value !== undefined) this.headers[String(name).toLowerCase()] = value;
    }
    this.getHeaders = () => ({ ...this.headers });
    this.setHeader = (name, value) => {
      validateHeaderName(name);
      validateHeaderValue(name, value);
      this.headers[String(name).toLowerCase()] = value;
      return this;
    };
    this.getHeader = (name) => this.headers[String(name).toLowerCase()];
    this.removeHeader = (name) => {
      delete this.headers[String(name).toLowerCase()];
    };
    this._chunks = [];
    this._bytes = 0;
  }

  _write(chunk, _encoding, callback) {
    this._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    this._bytes += chunk.length;
    callback();
  }

  _final(callback) {
    this.finished = true;
    Promise.resolve()
      .then(() => this._perform())
      .then(
        () => callback(),
        (err) => {
          if (this.listenerCount("error") > 0) {
            this.emit("error", err);
            callback();
          } else {
            callback(err);
          }
        },
      );
  }

  _perform() {
    if (this.aborted) return;
    const url = clientUrl(this._options);
    const body =
      this._options.body !== undefined
        ? String(this._options.body)
        : this._chunks.length > 0
          ? Buffer.concat(this._chunks).toString("utf8")
          : undefined;
    const request = {
      method: this.method,
      headers: Object.fromEntries(
        Object.entries(this.headers).map(([name, value]) => [name, String(value)]),
      ),
      body,
    };
    const json = api().fetch(url, request);
    const reply = JSON.parse(json);
    const headers = {};
    const rawHeaders = [];
    for (const [name, value] of reply.headers ?? []) {
      const key = String(name).toLowerCase();
      rawHeaders.push(name, value);
      if (key === "set-cookie") {
        (headers[key] ??= []).push(value);
      } else if (key in headers) {
        headers[key] = `${headers[key]}, ${value}`;
      } else {
        headers[key] = value;
      }
    }
    const bytes = reply.body_b64
      ? Buffer.from(decodeBase64(reply.body_b64))
      : Buffer.from(reply.body ?? "", "utf8");
    const message = new IncomingMessage(new net.Socket(), {
      httpVersion: "1.1",
      headers,
      rawHeaders,
      body: bytes,
    }, {
      statusCode: reply.status,
      statusMessage: STATUS_CODES[reply.status] ?? "",
    });
    this.emit("response", message);
    process.nextTick(() => this.emit("close"));
  }

  setTimeout(_msecs, callback) {
    if (typeof callback === "function") this.once("timeout", callback);
    return this;
  }

  setNoDelay() {
    return this;
  }

  setSocketKeepAlive() {
    return this;
  }

  flushHeaders() {}

  abort() {
    if (this.aborted) return;
    this.aborted = true;
    this.destroy();
    this.emit("abort");
  }

  destroy(error) {
    if (error && this.listenerCount("error") > 0) this.emit("error", error);
    return super.destroy(error);
  }
}

export function request(urlOrOptions, optionsOrCallback, callback) {
  if (typeof urlOrOptions === "string") {
    const options = typeof optionsOrCallback === "object" ? { ...optionsOrCallback, href: urlOrOptions } : {};
    const merged = normalizeClientOptions(urlOrOptions);
    Object.assign(merged, options);
    // `href` is not an option Node reads; the parsed fields are what matter.
    delete merged.href;
    return new ClientRequest(merged, typeof optionsOrCallback === "function" ? optionsOrCallback : callback);
  }
  return new ClientRequest(
    urlOrOptions ?? {},
    typeof optionsOrCallback === "function" ? optionsOrCallback : callback,
  );
}

export function get(urlOrOptions, optionsOrCallback, callback) {
  const req = request(urlOrOptions, optionsOrCallback, callback);
  req.end();
  return req;
}
