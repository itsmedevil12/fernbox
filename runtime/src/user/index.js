// The boot bundle: the Node-shaped surface an app sees, built in the user
// context before its own script runs.
//
// Everything here is user-realm JS. It never holds a privileged object — it
// calls the frozen `fernbox` API, whose every argument crosses the two-context
// boundary as a string, and it builds every object it hands back out of JSON
// text it parsed itself. That is the whole of the boundary's guarantee, and
// this bundle is where it stays honest: if anything here reached for a
// system-context handle, the isolation would be a fiction.
//
// The entry script stays top-level code (like `node -e` with a `require`
// global) because its completion value is the run's result; only the modules
// it requires get a CommonJS wrapper.

import { makeProcess } from "./process.js";
import { makeConsole } from "./console.js";
import { makeRequire } from "./require.js";
import { dirname } from "./builtins/path.js";
import * as fs from "./builtins/fs.js";
import * as path from "./builtins/path.js";
import * as os from "./builtins/os.js";
import * as http from "./builtins/http.js";
import * as shell from "./shell.js";
import * as child_process from "./builtins/child_process.js";
import stream from "./builtins/stream.js";
import * as buffer from "./builtins/buffer.js";
import events from "./builtins/events.js";
import assert from "./builtins/assert.js";
import async_hooks from "./builtins/async_hooks.js";
import crypto from "./builtins/crypto.js";
import diagnostics_channel from "./builtins/diagnostics_channel.js";
import dns from "./builtins/dns.js";
import module from "./builtins/module.js";
import http2 from "./builtins/http2.js";
import https from "./builtins/https.js";
import net from "./builtins/net.js";
import querystring from "./builtins/querystring.js";
import string_decoder from "./builtins/string_decoder.js";
import timers from "./builtins/timers.js";
import tls from "./builtins/tls.js";
import tty from "./builtins/tty.js";
import url from "./builtins/url.js";
import worker_threads from "./builtins/worker_threads.js";
import util from "./builtins/util.js";
import zlib from "./builtins/zlib.js";

// The virtual path the entrypoint sits at, injected by the host alongside the
// env and argv, so the top level gets a real `__dirname`.
const entry = globalThis.__fernbox_entry ?? "/main.js";

const process = makeProcess();
const console = makeConsole(process);

// Builtins are frozen: a script cannot swap `fs.readFileSync` for one that
// reads past the policy, because the chokepoint beneath them is what decides.
//
// `shell` is a FernBox name rather than Node's, and it is here for two reasons:
// the boot bundle is inlined by esbuild so an image file cannot import it by
// path, and `/bin/sh.js` needs the same runner `child_process` uses — one
// implementation, reached as a builtin by name.
//
// The Node names are the surface a framework's dependency tree loads at import
// time. A module that cannot find one of these dies before the app's first
// line runs, so the set has to cover what the polyfills in `runtime/stdlib_plugin.mjs`
// would have covered had the dependency been bundled — same modules, same
// implementations, just reachable by `require` from app code.
const builtins = {
  fs,
  path,
  os,
  http,
  http2: http2,
  https: https,
  shell,
  child_process,
  stream,
  buffer,
  events,
  util,
  assert,
  async_hooks,
  diagnostics_channel,
  dns,
  module,
  url,
  querystring,
  string_decoder,
  tty,
  crypto,
  zlib,
  net,
  tls,
  timers,
  worker_threads,
  sys: util,
};
for (const name of Object.keys(builtins)) Object.freeze(builtins[name]);

// `process` and its neighbours are the realm's live singletons, not module
// namespaces: freezing them would break `process.exitCode = 1` and the
// `require("process") === globalThis.process` identity code checks for.
builtins.process = process;
builtins["util/types"] = util.types ?? {};
builtins["timers/promises"] = timers.promises;
builtins["fs/promises"] = fs.promises;

const require = makeRequire({ entry, builtins });

// `process` stays mutable the way Node's is — `process.exitCode = 1` is how a
// script signals, and freezing it would silently drop the signal.
globalThis.process = process;
globalThis.console = console;
globalThis.require = require;
globalThis.__filename = entry;
globalThis.__dirname = dirname(entry);

// The globals a Node-oriented dependency reaches for at import time. `Buffer`
// is the very class the `buffer` builtin exports, so `Buffer.isBuffer` agrees
// with the bytes the `http` module pushes; `global` is the realm itself, which
// browserify polyfills probe for. The timers wrap the `fernbox` scheduler — the
// only one there is — and forward extra arguments the way Node's do, since the
// chokepoint takes just a callback and a delay.
globalThis.Buffer = buffer.Buffer;
globalThis.global = globalThis;

// `url.URL` and `url.URLSearchParams` are globals in Node, and dependencies
// construct them without importing `url`. The classes come from the same
// builtin, so a URL an app makes and one `http` parses are the same shape.
globalThis.URL = url.URL;
globalThis.URLSearchParams = url.URLSearchParams;

globalThis.setTimeout = (fn, ms = 0, ...args) => fernbox.setTimeout(() => fn(...args), ms);
globalThis.setInterval = (fn, ms = 0, ...args) => fernbox.setInterval(() => fn(...args), ms);
globalThis.clearTimeout = (id) => fernbox.clearTimeout(id);
globalThis.clearInterval = (id) => fernbox.clearInterval(id);
globalThis.setImmediate = (fn, ...args) => fernbox.setTimeout(() => fn(...args), 0);
globalThis.clearImmediate = (id) => fernbox.clearTimeout(id);
globalThis.queueMicrotask = (fn) => {
  Promise.resolve().then(() => fn());
};
