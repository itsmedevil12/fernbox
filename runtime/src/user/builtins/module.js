// The `module` builtin: `createRequire` and the builtin registry, and a
// `Module` only as far as compiling a string into one.
//
// `createRequire` is real: it hands back a require rooted where the caller
// asked, through the same loader every other module uses. `builtinModules`
// answers for this realm's modules, not Node's — a probe asking whether `zlib`
// is builtin gets the truth about what `require("zlib")` does here.
import { dirname } from "./path.js";
import { makeRequireFrom } from "../require.js";

const MODULES = [
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "crypto",
  "diagnostics_channel",
  "dns",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "module",
  "net",
  "os",
  "path",
  "process",
  "querystring",
  "shell",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "timers/promises",
  "tls",
  "tty",
  "url",
  "util",
  "util/types",
  "worker_threads",
  "zlib",
];

// A filename given as a URL (`import.meta.url`-style) names the same file; the
// virtual fs is posix, so the URL's pathname is the path.
function asPath(filename) {
  const text = String(filename);
  if (!text.startsWith("file:")) return text;
  try {
    return decodeURIComponent(new URL(text).pathname);
  } catch {
    return text;
  }
}

export function createRequire(filename) {
  return makeRequireFrom(dirname(asPath(filename)));
}

export function isBuiltin(name) {
  const bare = String(name).replace(/^node:/, "");
  return MODULES.includes(bare);
}

export const builtinModules = [...MODULES];

export function syncBuiltinESMExports() {}

// Enough of `Module` for code that compiles a fresh CommonJS source (the
// `require-from-string` pattern JSON schema compilers use). It is not the
// loader's cache and does not add itself to it.
export class Module {
  constructor(id = "", parent = null) {
    this.id = id;
    this.filename = id;
    this.path = id ? dirname(id) : ".";
    this.exports = {};
    this.parent = parent;
    this.children = [];
    this.loaded = false;
    this.paths = [];
  }

  _compile(source, filename) {
    const require = createRequire(filename);
    const dir = dirname(filename);
    const fn = new Function("exports", "require", "module", "__filename", "__dirname", source);
    fn.call(this.exports, this.exports, require, this, filename, dir);
    this.loaded = true;
    return this.exports;
  }

  static createRequire = createRequire;
}

export default { createRequire, isBuiltin, builtinModules, syncBuiltinESMExports, Module };
