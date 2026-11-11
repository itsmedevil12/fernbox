// The `dns` builtin: the lookups a server needs, and no resolver behind them.
//
// There is no DNS in the sandbox, so a name that would require a query is
// ENOTFOUND. What is answered is the set a binding already knows: loopback
// names and IP literals. A framework calls `lookup` to report which addresses
// its listener covers; refusing `localhost` there would make it think it had
// nowhere to bind.
import { isIP } from "./net.js";

const LOCAL = new Map([
  ["localhost", "127.0.0.1"],
  ["127.0.0.1", "127.0.0.1"],
  ["::1", "::1"],
  ["0.0.0.0", "127.0.0.1"],
  ["::", "::1"],
]);

function localAddress(hostname) {
  const name = String(hostname).toLowerCase();
  if (LOCAL.has(name)) return LOCAL.get(name);
  return isIP(name) === 0 ? null : name;
}

function notFound(hostname) {
  const err = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
  err.code = "ENOTFOUND";
  err.errno = -3008;
  err.syscall = "getaddrinfo";
  err.hostname = hostname;
  return err;
}

// Node's shape: `(hostname, options, callback)` or `(hostname, callback)`, with
// `all` asking for `[{ address, family }]` and `family` narrowing the answer.
export function lookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  if (typeof callback !== "function") throw new TypeError("dns.lookup needs a callback");
  const { all = false, family = 0 } = options ?? {};
  const address = localAddress(hostname);
  process.nextTick(() => {
    if (address === null) return callback(notFound(hostname));
    const found = address.includes(":") ? 6 : 4;
    if (family !== 0 && family !== found) return callback(notFound(hostname));
    if (all) callback(null, [{ address, family: found }]);
    else callback(null, address, found);
  });
}

// Everything that would be a real query lands on the same refusal, delivered
// asynchronously and in the callback, the way dns's own errors are.
function unsupported(record) {
  const err = new Error(`dns.${record} is not available in the sandbox (no resolver)`);
  err.code = "ERR_DNS_UNSUPPORTED";
  return err;
}

function refuse(record) {
  return function (...args) {
    const callback = args[args.length - 1];
    const err = unsupported(record);
    if (typeof callback === "function") process.nextTick(() => callback(err));
  };
}

export const resolve = refuse("resolve");
export const resolve4 = refuse("resolve4");
export const resolve6 = refuse("resolve6");
export const resolveAny = refuse("resolveAny");
export const resolveCname = refuse("resolveCname");
export const resolveMx = refuse("resolveMx");
export const resolveNs = refuse("resolveNs");
export const resolveTxt = refuse("resolveTxt");
export const reverse = refuse("reverse");

export function lookupService(address, port, callback) {
  process.nextTick(() => callback(null, String(address), String(port)));
}

export const promises = {
  lookup(hostname, options = {}) {
    return new Promise((resolvePromise, reject) => {
      lookup(hostname, options, (err, address) => (err ? reject(err) : resolvePromise(address)));
    });
  },
  resolve: async () => {
    throw unsupported("resolve");
  },
  reverse: async () => {
    throw unsupported("reverse");
  },
};

export default {
  lookup,
  lookupService,
  resolve,
  resolve4,
  resolve6,
  resolveAny,
  resolveCname,
  resolveMx,
  resolveNs,
  resolveTxt,
  reverse,
  promises,
};
