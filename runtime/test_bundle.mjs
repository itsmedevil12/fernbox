// Spikes whether the runtime bundles and boots in a bare V8-like context.
//
// It bundles an entry with the same plugin the production build uses, then
// executes the resulting IIFE inside a `vm` context that deliberately exposes
// almost nothing: no `require`, no Node `Buffer`/`process`/`global`, only what
// the isolate would provide. If the bundle runs here, it runs in the system
// context; if it reaches for an ambient Node global, that's a real find that
// would otherwise only show up as a runtime error inside the isolate.
//
//   node test_bundle.mjs [entry] [image-js] [probe]
//
// `image-js` is a file emitted by build.mjs (`image_<name>.js`) and is
// evaluated first, exactly as the host evaluates it before the runtime boots.
// `probe` is an optional script run after the runtime; it sees the `__fernbox`
// API exactly as the user context would, and its thrown errors are reported as
// failures rather than boot failures.
import * as esbuild from "esbuild";
import { nodeStdlib } from "./stdlib_plugin.mjs";
import vm from "node:vm";
import fs from "node:fs";

const entry = process.argv[2] ?? "src/index.js";
const imageFile = process.argv[3];
const probeFile = process.argv[4];

// Prepended to the bundle so it runs before any module body, exactly as
// build.mjs does for the artifact the Rust side embeds.
const banner = fs.readFileSync(new URL("./src/shim.js", import.meta.url), "utf8");

const bundle = (
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    write: false,
    plugins: [nodeStdlib],
    define: {},
    banner: { js: banner },
    minify: false,
    sourcemap: false,
    legalComments: "none",
  })
).outputFiles[0].text;

console.log(`bundle: ${Buffer.byteLength(bundle)} bytes`);

// Deliberately empty: the point is to find every ambient the bundle reaches for
// before believing it boots in the isolate. `console` is the one exception —
// the runtime has no other way to report a boot failure from inside.
const sandbox = {
  console: {
    log: (...args) => console.log("  [sandbox]", ...args),
    error: (...args) => console.error("  [sandbox]", ...args),
    warn: (...args) => console.warn("  [sandbox]", ...args),
  },
};

const context = vm.createContext(sandbox, { name: "fernbox-sandbox" });

const run = (source, label) => {
  try {
    vm.runInContext(source, context, { filename: label });
    return true;
  } catch (err) {
    console.log(`${label} FAILED:`, err?.constructor?.name, err?.message?.slice(0, 300));
    if (err?.stack) console.log(err.stack.split("\n").slice(0, 6).join("\n"));
    return false;
  }
};

let ok = true;
if (imageFile) {
  ok = run(fs.readFileSync(imageFile, "utf8"), "image.js") && ok;
}
ok = run(bundle, "runtime.js") && ok;

if (ok && probeFile) {
  ok = run(fs.readFileSync(probeFile, "utf8"), "probe.js") && ok;
}

if (ok) console.log("BOOT OK");
else process.exitCode = 1;
