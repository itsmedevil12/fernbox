// The virtual OS that boots in the system context.
//
// It is deliberately small: the system context is the privileged side of the
// two-context boundary, so anything it imports is trusted code that ships with
// the daemon. Untrusted code never sees this object — it sees the frozen
// `fernbox` API that vm.rs installs in the user context, whose every call is
// marshalled to strings and back.
//
// Layout of the virtual filesystem:
//
//   base      a memfs volume seeded from the selected embedded image. It is
//             wrapped read-only: images are checked in and shared, and must not
//             drift at runtime.
//   volumes   one memfs volume per attached mount, seeded with the mount's
//             saved contents. Writable, but only within the mount subtree;
//             `__fernbox.snapshot` reads them back so the host can persist them.
//   writable  an empty memfs volume. It is searched first, so a path that has
//             been written shadows the image; a path that has not falls through
//             to the volumes and then the image. This is the union of them all.
//   link      a handful of paths are redirected into a private corner of the
//             writable layer, so per-instance state lives under one root.
//
// unionfs routes a write to whichever layer already holds the file, which would
// put writes into the image; searching writable first and rejecting writes on
// the base layer together make every write land in the writable layer instead.

import { Buffer } from "buffer";
import { Volume } from "memfs";
import { ufs } from "unionfs";
import { link } from "linkfs";
import path from "path";

// memfs and unionfs classify readdir entries against an ambient `Buffer`. The
// system context has no Node globals, so the bundle installs the polyfill
// itself; the user context is separate and never sees it.
if (!globalThis.Buffer) globalThis.Buffer = Buffer;

// Anything that could mutate the layer. The base image is embedded in the
// binary and shared by every instance, so it must reject all of these.
const MUTATING = new Set([
  "open", "openSync",
  "write", "writeSync", "writev", "writevSync",
  "writeFile", "writeFileSync",
  "appendFile", "appendFileSync",
  "mkdir", "mkdirSync", "mkdtemp", "mkdtempSync",
  "rm", "rmSync", "rmdir", "rmdirSync",
  "unlink", "unlinkSync",
  "rename", "renameSync", "copyFile", "copyFileSync",
  "symlink", "symlinkSync", "link", "linkSync",
  "truncate", "truncateSync", "ftruncate", "ftruncateSync",
  "chmod", "chmodSync", "lchmod", "lchmodSync",
  "chown", "chownSync", "lchown", "lchownSync",
  "utimes", "utimesSync", "lutimes", "lutimesSync",
  "fchmod", "fchmodSync", "fchown", "fchownSync",
  "futimes", "futimesSync",
  "createWriteStream",
]);

function readOnly(volume) {
  const deny = () => {
    const err = new Error("EPERM: operation not permitted, base image is read-only");
    err.code = "EPERM";
    throw err;
  };
  return new Proxy(volume, {
    get(target, key) {
      if (typeof key === "string" && MUTATING.has(key)) return deny;
      return Reflect.get(target, key);
    },
  });
}

// The image chosen for this instance, injected by the host as a plain
// { "/posix/path": "contents" } map before this bundle runs.
const base = readOnly(Volume.fromJSON(globalThis.__fernbox_image ?? {}));

// The writable, pre-seeded layers the host attached for persistent state. Each
// is a memfs volume holding exactly its own mount subtree; the union merges them
// with the image the same way it merges the writable layer.
const volumes = (globalThis.__fernbox_volumes ?? []).map((v) => ({
  mount: v.mount,
  layer: Volume.fromJSON(v.files ?? {}),
}));

const writable = new Volume();

// `use` pushes onto the stack and the union searches it from the top, so the
// last layer used is consulted first: writable, then each volume, then the
// image. A volume shadows the image under its own mount, and nothing shadows a
// file the script has actually written. Each `use` takes exactly one layer:
// unionfs copies its `F_OK` & co. onto the union, so a call with no argument
// makes it read them off `undefined`.
for (const layer of [base, ...volumes.map((v) => v.layer), writable]) ufs.use(layer);

// Redirected paths live under a private root of the writable layer, so the
// whole of an instance's own state can be found, enumerated, and later quota'd
// under one directory. They are created up front so an empty redirected
// directory reads as empty rather than missing.
const REDIRECTS = ["/tmp", "/var/tmp"].map((p) => [p, `/writable${p}`]);
for (const [, target] of REDIRECTS) {
  writable.mkdirSync(target, { recursive: true });
}
const fs = link(ufs, REDIRECTS);

// A write goes to the layer that owns the path: a volume's mount subtree is
// written into that volume, everything else into the writable layer. Reads
// resolve through the same rule, so a write always lands where its own read
// finds it.
//
// The target is resolved through REDIRECTS first: reads go through linkfs, which
// rewrites /tmp to /writable/tmp, so a write that skipped this step would put
// the file where its own read back cannot find it. A volume mounted inside a
// redirected path wins the resolution, which is the sane outcome but untested.
function write(target, data) {
  const { layer, resolved } = layerFor(target);
  const dir = path.posix.dirname(resolved);
  if (dir !== "/" && !layer.existsSync(dir)) {
    layer.mkdirSync(dir, { recursive: true });
  }
  layer.writeFileSync(resolved, data);
  return byteLength(data);
}

// The layer that owns a path, and the path as that layer spells it. Every
// mutation routes through here — write, mkdir, unlink, rename — so they all
// follow one rule and a volume's mount subtree stays in its own volume.
function layerFor(target) {
  const volume = volumeFor(target);
  const layer = volume ? volume.layer : writable;
  const resolved = volume ? target : resolveRedirect(target);
  return { layer, resolved };
}

// The mount matches at the segment boundary — /data owns /data and /data/x but
// not /datafoo — the same rule REDIRECTS uses.
function volumeFor(target) {
  return volumes.find(
    (v) => target === v.mount || target.startsWith(`${v.mount}/`),
  );
}

// The same segment-boundary rule linkfs applies: /tmp matches /tmp and /tmp/x
// but not /tmpfoo. Kept beside REDIRECTS so the two stay in step.
function resolveRedirect(target) {
  for (const [from, to] of REDIRECTS) {
    if (target === from) return to;
    if (target.startsWith(`${from}/`)) return `${to}${target.slice(from.length)}`;
  }
  return target;
}

function byteLength(text) {
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

function read(target) {
  try {
    return fs.readFileSync(target, "utf8");
  } catch (err) {
    // Missing files are the one expected failure; anything else is a real
    // error and should surface to the caller rather than look like absence.
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

// The ops beyond read/write/list answer in JSON, because a refusal needs to
// carry its code alongside its message. `read` hands back the contents
// themselves and cannot, which is why a missing file is null over there rather
// than an error object; these can, so a caller's `catch` sees `ENOENT` rather
// than guessing at text.
function fail(err) {
  return JSON.stringify({
    error: err?.code ?? "EIO",
    message: err?.message ?? String(err),
  });
}

function mkdir(target, optionsJson) {
  // `recursive` is the only option that matters, and the one a `mkdir -p` needs
  // to avoid an EEXIST on a directory that is already there.
  const { recursive = false } = optionsJson ? JSON.parse(optionsJson) : {};
  const { layer, resolved } = layerFor(target);
  try {
    copyUpParents(layer, resolved);
    layer.mkdirSync(resolved, { recursive });
    return '{"ok":true}';
  } catch (err) {
    return fail(err);
  }
}

// A layer can only hold a path whose parent it already holds, but the union
// answers for that parent from anywhere: `/etc` exists as far as a read is
// concerned, because the image has it, so a `mkdir /etc/new` that goes straight
// to the writable layer gets ENOENT for a path whose parent plainly exists.
//
// The fix is overlayfs's: copy the missing ancestors up as empty directories.
// unionfs merges a directory's entries across layers, so an copied-up `/etc`
// still shows the image's own files beneath the new one. Ancestor that is a
// file in the union is left alone, so the mutation fails with the honest
// ENOTDIR; an ancestor missing from the union entirely is left to `recursive`,
// which is what creates it, and to ENOENT when it is off.
function copyUpParents(layer, target) {
  const dir = path.posix.dirname(target);
  if (dir === "/" || !fs.existsSync(dir)) return;
  copyUpParents(layer, dir);
  if (layer.existsSync(dir)) return;
  const st = fs.statSync(dir);
  if (!st.isDirectory()) {
    // A file where an ancestor should be: the same thing a real `mkdir` says,
    // rather than an ENOENT that names a path the caller can see is there.
    const err = new Error(`ENOTDIR: not a directory, mkdir '${target}'`);
    err.code = "ENOTDIR";
    throw err;
  }
  layer.mkdirSync(dir);
}

function stat(target) {
  // A stat reads, so it goes through the union rather than one layer: the path
  // a caller asks about may well be an image file this instance never wrote.
  try {
    const st = fs.statSync(target);
    return JSON.stringify({
      type: st.isDirectory() ? "dir" : "file",
      size: st.size,
    });
  } catch (err) {
    return fail(err);
  }
}

function readdir(target) {
  try {
    return JSON.stringify(fs.readdirSync(target));
  } catch (err) {
    return fail(err);
  }
}

function exists(target) {
  // Exists never fails — that is the whole point of it — so it answers a bare
  // boolean rather than an envelope.
  return JSON.stringify(fs.existsSync(target));
}

function unlink(target) {
  const { layer, resolved } = layerFor(target);
  try {
    layer.unlinkSync(resolved);
    return '{"ok":true}';
  } catch (err) {
    return fail(err);
  }
}

function rmdir(target) {
  // Like a real `rmdir`, the directory must be empty; removing a full subtree is
  // what `rm -r` is for.
  const { layer, resolved } = layerFor(target);
  try {
    layer.rmdirSync(resolved);
    return '{"ok":true}';
  } catch (err) {
    return fail(err);
  }
}

function rename(from, to) {
  const source = layerFor(from);
  const dest = layerFor(to);
  // Two layers are two filesystems, and a real one says so: `EXDEV` is what a
  // move across mounts costs. Renaming within the writable layer or within one
  // volume is the case that works, and the one a caller means.
  if (source.layer !== dest.layer) {
    return fail({ code: "EXDEV", message: `cannot rename '${from}' across layers` });
  }
  const dir = path.posix.dirname(dest.resolved);
  if (dir !== "/" && !source.layer.existsSync(dir)) {
    source.layer.mkdirSync(dir, { recursive: true });
  }
  try {
    source.layer.renameSync(source.resolved, dest.resolved);
    return '{"ok":true}';
  } catch (err) {
    return fail(err);
  }
}

function list() {
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = dir === "/" ? `/${name}` : `${dir}/${name}`;
      out.push(p);
      if (fs.statSync(p).isDirectory()) walk(p);
    }
  };
  walk("/");
  return out.join("\n");
}

globalThis.__fernbox = {
  fsRead: (p) => read(p),
  fsWrite: (p, data) => write(p, data),
  fsList: () => list(),
  fsMkdir: (p, options) => mkdir(p, options),
  fsStat: (p) => stat(p),
  fsReaddir: (p) => readdir(p),
  fsExists: (p) => exists(p),
  fsUnlink: (p) => unlink(p),
  fsRmdir: (p) => rmdir(p),
  fsRename: (from, to) => rename(from, to),

  // The network layer is split along the boundary between what is virtual and
  // what is real. The hosts table is filesystem state, so it is read here, in
  // the virtual fs, fresh on every call — a write to /etc/hosts changes what
  // the next fetch resolves. The connection is Rust, on the other side of
  // __fernbox_net, because a socket must never exist in this context.
  httpFetch: (url, optionsJson) =>
    __fernbox_net.fetch(read("/etc/hosts") ?? "", url, optionsJson),

  // Pulls the volume layers back out as the same file map the host seeded them
  // with. The host is the only caller: the user-context API has no `snapshot`,
  // so a script cannot ask for its own persistence layer. `toJSON` on an empty
  // volume is `{}`, so an untouched volume round-trips as an empty mount rather
  // than a missing one.
  snapshot: () =>
    JSON.stringify(volumes.map((v) => ({ mount: v.mount, files: v.layer.toJSON() }))),
};

// A canary the escape fixtures must never reach. Any probe that reads this
// string has broken out of the user context.
globalThis.__fernbox_secret = "SYSTEM_CONTEXT_CANARY";
