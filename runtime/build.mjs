// Bundles the two runtimes and the base images into files that Rust embeds with
// include_str!. Kept as a build.mjs so the exact flags live next to the sources.
//
// There are two bundles because there are two contexts, and they must never
// meet: `src/index.js` is the virtual OS, booted in the privileged system
// context where `__fernbox` lives; `src/user/index.js` is the Node-shaped
// surface the untrusted script sees, booted in the user context where
// `fernbox` is the only privileged thing it can reach.
import * as esbuild from "esbuild";
import { nodeStdlib } from "./stdlib_plugin.mjs";
import fs from "node:fs";
import path from "node:path";
const out = process.argv[2];
if (!out) {
  console.error("usage: node build.mjs <output-path>");
  process.exit(1);
}
const outDir = path.dirname(out);

// Prepended to both bundles so it runs before any module body: polyfills read
// `process` at import time, and an ordinary import in index.js would initialize
// after them. The user bundle installs its own fuller `process` a moment later,
// overwriting this content-free one; the banner only has to exist early enough
// for the bundled stream/buffer polyfills to load.
const banner = fs.readFileSync(path.join(import.meta.dirname, "src/shim.js"), "utf8");

// Flags shared by both bundles: an IIFE so top-level names stay inside, and
// `platform: browser` so esbuild asks for nothing Node provides.
const shared = {
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  write: true,
  plugins: [nodeStdlib],
  // The bundles run in a context with no DOM and no Node globals; anything
  // they need must come from __fernbox, not from the ambient environment.
  define: {},
  // Deliberately not minified, despite the savings: V8 retains a compiled
  // script's source on the isolate's heap, so an 865 KB bundle is roughly
  // 1.7 MB of retained heap, and minifying it drops a worker's private memory
  // by about 1.3 MB. Measured against `fixtures/apps/bench`, though, the
  // minified bundle is 30-70% slower across the board — the pure-JS control
  // included — because the mangled call sites optimize worse than the original
  // names do. That is a bad trade for a sandbox whose reason for existing is
  // running untrusted code quickly, so the runtime ships readable and the
  // memory is spent.
  minify: false,
  sourcemap: false,
  legalComments: "none",
};

await esbuild.build({ ...shared, entryPoints: ["src/index.js"], outfile: out, banner: { js: banner } });
await esbuild.build({ ...shared, entryPoints: ["src/user/index.js"], outfile: path.join(outDir, "user_runtime.js"), banner: { js: banner } });

// Each checked-in directory under images/ is one base image, emitted as bare
// JSON so both sides consume the same artifact: the host wraps it in a
// `globalThis.__fernbox_image = ...` assignment at injection time, and the
// daemon can merge it with an app folder's file map in Rust without parsing JS.
const imagesDir = path.join(import.meta.dirname, "images");

// `/bin/npm.js` inflates the tarballs it fetches, and the inflator is a
// dependency of the image rather than of the host: the sandbox cannot reach
// this directory's node_modules, so the base image ships its own copy under
// /node_modules the way a real one ships its libraries. The UMD build is one
// CommonJS file, which is the shape the loader compiles; its
// `require("worker_threads")` sits inside a try/catch, so a context with no
// worker threads keeps the synchronous path and never needs the ambient.
const fflate = {
  "/node_modules/fflate/package.json": JSON.stringify({
    name: "fflate",
    version: JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, "node_modules/fflate/package.json"), "utf8"),
    ).version,
    main: "index.js",
  }),
  "/node_modules/fflate/index.js": fs.readFileSync(
    path.join(import.meta.dirname, "node_modules/fflate/umd/index.js"),
    "utf8",
  ),
};

// An image may declare a parent in a `fernbox.json` the walker never admits
// into the filesystem: `{"from":"minimal"}` layers that parent underneath this
// image's own files. The parent is resolved first and the child's files land
// on top of it — the same ordering the daemon's volume commit uses — so an
// image overrides an inherited file by shipping its own copy. What is emitted
// stays a flat map, so neither the isolate nor the daemon learns that layers
// exist: inheritance is a build-time convenience, not a runtime concept.
const MANIFEST = "fernbox.json";

function resolveImage(name, stack) {
  if (stack.includes(name)) {
    throw new Error(`image '${name}' inherits itself: ${[...stack, name].join(" -> ")}`);
  }
  const dir = path.join(imagesDir, name);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`image '${name}' does not exist under images/`);
  }
  const files = {};
  collect(dir, "/", files);
  if (name === "base") Object.assign(files, fflate);
  const manifestPath = path.join(dir, MANIFEST);
  if (fs.existsSync(manifestPath)) {
    const { from } = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (from) return { ...resolveImage(from, [...stack, name]), ...files };
  }
  return files;
}

for (const entry of fs.readdirSync(imagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  fs.writeFileSync(
    path.join(outDir, `image_${entry.name}.json`),
    JSON.stringify(resolveImage(entry.name, [])),
  );
}

// Walks an image directory on disk into a flat { "/posix/path": contents } map,
// the shape memfs's Volume.fromJSON takes. Host separators are normalised, so
// the same images bundle on Windows and POSIX hosts. The manifest is skipped
// only at an image's root: it describes the image, it is not a file in it.
function collect(dir, prefix, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const posix = `${prefix}${entry.name}`.split(path.sep).join("/");
    if (entry.isDirectory()) {
      collect(abs, `${posix}/`, files);
    } else if (entry.isFile() && !(prefix === "/" && entry.name === MANIFEST)) {
      files[posix] = fs.readFileSync(abs, "utf8");
    }
  }
}
