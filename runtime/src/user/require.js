// `require`, and the CommonJS loader behind it.
//
// The entry script is top-level code, not a module: `vm.rs`'s completion value
// is the run's result, and wrapping the entry would throw that value away. So
// `require` is a global installed before the script runs, and only the modules
// it pulls in get the `(module, exports, require, __filename, __dirname)`
// wrapper.
//
// Modules are compiled with the realm's own `new Function`, so a module's scope
// chain reaches the user global — `require`, `process`, `console` — and nothing
// of the boot bundle's own locals.

import { dirname, isAbsolute, join, normalize } from "./builtins/path.js";
import { COMMAND_DIRS } from "./commands.js";

// One cache per context: a run never shares loaded modules with another, and a
// `require` cycle gets the partially-built `module.exports` the way it does
// under Node. It lives here rather than in `makeRequire` because the shell's
// runner loads command files through `loadCommand` below and must see the same
// cache an app's own `require` fills.
const cache = new Map();

// The loader the shell's runner uses to invoke a command file. `require` refuses
// a path under `/bin` — commands are run through `child_process`, not imported —
// and this is the one caller allowed past that rule. It is bound late, because
// the loader closes over the builtins `makeRequire` is handed; nothing else sets
// it, `makeRequire` being the boot bundle's one call. It is not on any builtin
// namespace an app can reach, so the unrestricted path stays with the runner.
let loadModule = null;

export const loadCommand = (resolved) => {
  if (!loadModule) throw new Error("the module loader is not ready yet");
  return loadModule(resolved);
};

// The `module` builtin's `createRequire` needs a require rooted at an
// arbitrary directory, which is the one capability the entry-point require
// does not expose. It is bound late for the same reason `loadModule` is: both
// close over the builtins `makeRequire` is handed.
let fromDirectory = null;

export const makeRequireFrom = (dir) => {
  if (!fromDirectory) throw new Error("the module loader is not ready yet");
  return fromDirectory(dir);
};

export function makeRequire({ entry, builtins }) {
  const isDir = (p) => JSON.parse(globalThis.fernbox.fs.stat(p) ?? '{"type":"file"}').type === "dir";

  // The file phase: the path itself, then `.js`, `.json`, then `index.js` /
  // `index.json`. This is the only place that looks a path up, and it never
  // walks `node_modules` — the walk is a separate phase, and letting it recurse
  // in here would loop forever on any id that cannot be found.
  const resolveAsFile = (base) => {
    for (const candidate of [base, `${base}.js`, `${base}.json`, `${base}/index.js`, `${base}/index.json`]) {
      // A directory named the same as a requested file would otherwise resolve
      // to itself and read as a directory.
      if (globalThis.fernbox.fs.exists(candidate) && !isDir(candidate)) return candidate;
    }
    return packageMain(base);
  };

  const resolve = (id, fromDir) => {
    // Node's rule: a bare id is a package name, so it goes straight to
    // `node_modules` and never to a file in the app that happens to share its
    // name. Without this, an app-level `express.js` would shadow the `express`
    // package, and `require.resolve("express")` would answer with the app file.
    if (!id.startsWith(".") && !isAbsolute(id)) return nodeModules(id, fromDir);
    const base = isAbsolute(id) ? normalize(id) : normalize(join(fromDir, id));
    return resolveAsFile(base) ?? nodeModules(id, fromDir);
  };

  // `package.json`'s `main`, resolved as the package author spelled it: a bare
  // `"main": "lib/index.js"` is relative to the package, and `"./lib/x.js"` and
  // `"lib/x.js"` mean the same thing.
  const packageMain = (base) => {
    const pkg = `${base}/package.json`;
    if (!globalThis.fernbox.fs.exists(pkg)) return null;
    const json = globalThis.fernbox.read(pkg);
    let main;
    try {
      main = JSON.parse(json ?? "{}").main;
    } catch {
      return null;
    }
    if (typeof main !== "string" || main === "") return null;
    const spelled = main.startsWith("./") ? main.slice(2) : main;
    return resolveAsFile(join(base, spelled));
  };

  // Walk up looking for `node_modules/<id>`, the way Node does from the
  // requiring module's directory to the root.
  const nodeModules = (id, fromDir) => {
    let dir = fromDir;
    for (;;) {
      const found = resolveAsFile(join(dir, "node_modules", id));
      if (found) return found;
      const up = dirname(dir);
      if (up === dir) return null; // the root is its own parent
      dir = up;
    }
  };

  const load = (resolved) => {
    const cached = cache.get(resolved);
    if (cached) return cached.exports;

    const source = globalThis.fernbox.read(resolved);
    if (source === null || source === undefined) {
      const err = new Error(`ENOENT: no such file or directory, open '${resolved}'`);
      err.code = "ENOENT";
      throw err;
    }

    const module = { id: resolved, filename: resolved, exports: {}, loaded: false };
    // Written before the module runs, so a cycle that comes back around finds
    // the partially-populated exports rather than recursing forever.
    cache.set(resolved, module);
    // Node loads a `.json` file as data, not as JavaScript — `require` of a
    // `package.json` is how a library reads its own version.
    if (resolved.endsWith(".json")) {
      try {
        module.exports = JSON.parse(source.replace(/^\uFEFF/, ""));
      } catch (err) {
        cache.delete(resolved);
        throw new SyntaxError(`${resolved}: ${err.message}`);
      }
      module.loaded = true;
      return module.exports;
    }
    const dir = dirname(resolved);
    try {
      let fn;
      try {
        fn = new Function(
          "module",
          "exports",
          "require",
          "__filename",
          "__dirname",
          source,
        );
      } catch (err) {
        // A compile error carries no filename from `new Function`; without
        // this, a dependency that ships a syntax the context does not support
        // reports only the token and no place to look.
        err.message = `${err.message} (while compiling ${resolved})`;
        throw err;
      }
      fn(module, module.exports, requireFrom(dir), resolved, dir);
    } catch (err) {
      // A failed module must not poison the cache for a retry that fixes it.
      cache.delete(resolved);
      throw err;
    }
    module.loaded = true;
    return module.exports;
  };

  // A command directory holds commands, not libraries: an app that wants `npm`
  // runs it, it does not import it. The check is on the resolved path rather than
  // the id as spelled, so `./bin/npm` from the root and `/bin/npm.js` are the same
  // refusal, and so is `/usr/bin/ls` on an image that keeps its commands there.
  // This is an interface rule, not a permission boundary — nothing in the user
  // realm holds privilege a shim would confer, since a command's code runs with
  // the same chokepoints the app's own code does. It keeps the two surfaces
  // distinct the way they are on a real machine, where a binary is an executable
  // and not a loadable module.
  const isCommand = (resolved) =>
    COMMAND_DIRS.some((dir) => resolved === dir || resolved.startsWith(`${dir}/`));

  // `node:` is a scheme, not a path: Node resolves `node:fs` to the same
  // builtin `fs` is, and dependency code uses both spellings. Strip it before
  // the builtin lookup so neither spelling reaches the filesystem resolver.
  const stripNodeScheme = (id) =>
    id.startsWith("node:") ? id.slice("node:".length) : id;

  const requireFrom = (dir) => {
    const require = (id) => {
      const name = stripNodeScheme(id);
      if (Object.prototype.hasOwnProperty.call(builtins, name)) return builtins[name];
      const resolved = resolve(name, dir);
      if (!resolved) {
        const err = new Error(`Cannot find module '${id}'`);
        err.code = "MODULE_NOT_FOUND";
        throw err;
      }
      if (isCommand(resolved)) {
        const err = new Error(
          `Cannot require '${id}': it is a command, not a module; run it with child_process instead`,
        );
        err.code = "ERR_REQUIRE_COMMAND";
        throw err;
      }
      return load(resolved);
    };

    // `require.resolve` and `require.cache` are the two pieces of the real
    // object an average dependency reaches for; the rest (`extensions`,
    // `main`) would only be a lie about a loader that does not exist here. The
    // cache is the loader's, shared, so a module loaded twice is one module.
    require.resolve = (id) => {
      if (Object.prototype.hasOwnProperty.call(builtins, stripNodeScheme(id))) return id;
      const resolved = resolve(stripNodeScheme(id), dir);
      if (!resolved) {
        const err = new Error(`Cannot find module '${id}'`);
        err.code = "MODULE_NOT_FOUND";
        throw err;
      }
      return resolved;
    };
    Object.defineProperty(require, "cache", { get: () => cache });
    return require;
  };

  // The shell's runner picks this up: it loads a command file the app's own
  // `require` would refuse, which is the point of the split.
  loadModule = load;
  fromDirectory = requireFrom;

  return requireFrom(dirname(entry));
}
