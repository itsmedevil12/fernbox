// A posix-only `path`. The user context has no Node, so this is hand-rolled:
// small enough to read in one pass, and the only `path` an app ever sees. It is
// deliberately not `path/win32` — the virtual fs is posix, so a Windows host and
// a Linux host give the app the same separators.

export const sep = "/";
export const delimiter = ":";

export function isAbsolute(p) {
  return typeof p === "string" && p.charCodeAt(0) === 47;
}

export function normalize(p) {
  need(p);
  const absolute = isAbsolute(p);
  const out = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    // A leading `..` on a relative path has nothing above to cancel, so it is
    // kept; on an absolute one `/..` is `/`.
    if (seg === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
      else if (!absolute) out.push("..");
      continue;
    }
    out.push(seg);
  }
  const s = out.join("/");
  if (s === "") return absolute ? "/" : ".";
  return absolute ? `/${s}` : s;
}

// Node resolves from the last absolute argument outward; everything before it
// is context the caller did not mean to supply.
export function resolve(...paths) {
  let pending = "";
  let absolute = false;
  for (let i = paths.length - 1; i >= 0; i--) {
    const p = paths[i];
    need(p);
    if (p === "") continue;
    pending = `${p}/${pending}`;
    if (isAbsolute(p)) {
      absolute = true;
      break;
    }
  }
  return normalize(absolute ? pending : `/${pending}`);
}

export function join(...paths) {
  if (paths.length === 0) return ".";
  const joined = paths.filter((p) => need(p) !== "").join("/");
  return joined === "" ? "." : normalize(joined);
}

export function dirname(p) {
  need(p);
  if (p === "") return ".";
  const trimmed = p.replace(/\/+$/, "");
  // A path of nothing but slashes is the root, whose parent is itself.
  if (trimmed === "") return "/";
  const i = trimmed.lastIndexOf("/");
  if (i === -1) return ".";
  if (i === 0) return "/";
  return trimmed.slice(0, i);
}

export function basename(p, ext) {
  need(p);
  if (p === "") return "";
  const trimmed = p.replace(/\/+$/, "");
  const base = trimmed.slice(trimmed.lastIndexOf("/") + 1);
  if (ext && base.length > ext.length && base.endsWith(ext)) {
    return base.slice(0, base.length - ext.length);
  }
  return base;
}

export function extname(p) {
  const base = basename(need(p));
  const dot = base.lastIndexOf(".");
  // A leading dot names a dotfile, not an extension.
  if (dot <= 0) return "";
  return base.slice(dot);
}

export function relative(from, to) {
  const a = resolve(from);
  const b = resolve(to);
  if (a === b) return "";
  // Both are absolute and normalized, so the leading empty segment from the
  // split is noise; the rest compares directly.
  const fa = a.split("/").slice(1);
  const fb = b.split("/").slice(1);
  let i = 0;
  while (i < fa.length && i < fb.length && fa[i] === fb[i]) i++;
  const out = [];
  for (let k = i; k < fa.length; k++) out.push("..");
  for (let k = i; k < fb.length; k++) out.push(fb[k]);
  return out.join("/");
}

// Node's `path.parse`: the five pieces `format` turns back into a path.
export function parse(p) {
  need(p);
  const root = isAbsolute(p) ? "/" : "";
  const base = basename(p);
  const ext = extname(p);
  const dir = dirname(p);
  return {
    root,
    dir: dir === "." && root === "" ? "" : dir,
    base,
    ext,
    name: ext === "" ? base : base.slice(0, base.length - ext.length),
  };
}

export function format(pathObject) {
  const dir = pathObject.dir || pathObject.root || "";
  const base =
    pathObject.base || `${pathObject.name || ""}${pathObject.ext || ""}`;
  if (dir === "") return base;
  return dir === "/" ? `/${base}` : `${dir}/${base}`;
}

// `path.posix` is this module on a posix host, and the virtual host is posix;
// dependency code that spells `path.posix.join` gets the same functions.
export const posix = {
  sep,
  delimiter,
  isAbsolute,
  normalize,
  resolve,
  join,
  dirname,
  basename,
  extname,
  relative,
  parse,
  format,
};

export function toNamespacedPath(p) {
  return p;
}

function need(p) {
  if (typeof p !== "string") throw new TypeError("path must be a string");
  return p;
}
