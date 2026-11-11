// esbuild plugin that redirects bare Node-builtin specifiers to browser
// polyfills, so the Node-oriented fs packages bundle for a bare V8 isolate.
//
// The isolate has no `require` and no builtins, so `require("path")` etc. must
// be rewritten. node-stdlib-browser supplies the mapping; some of its entries
// are package *directories* rather than files, which esbuild cannot read, so
// those are resolved to their entry file first.
import stdlib from "node-stdlib-browser";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const resolved = new Map();

function entryFor(target) {
  if (resolved.has(target)) return resolved.get(target);
  const entry = fs.statSync(target).isDirectory()
    ? require.resolve(target)
    : target;
  resolved.set(target, entry);
  return entry;
}

export const nodeStdlib = {
  name: "node-stdlib-browser",
  setup(build) {
    build.onResolve({ filter: /^[a-z@]/ }, (args) => {
      const bare = args.path.replace(/^node:/, "");
      const target = stdlib[bare] ?? stdlib[args.path];
      if (!target) return null;
      return { path: entryFor(target) };
    });
  },
};
