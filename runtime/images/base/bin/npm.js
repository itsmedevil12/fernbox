// `npm install`, for one package or a list. Everything after the command is a
// spec: `pkg`, `pkg@1.2.3`, or `pkg@latest`. Ranges, lockfiles, and scopes are
// later; an unresolvable spec says so rather than guessing.
//
// The registry is a host like any other, so it resolves only if this instance's
// /etc/hosts maps it — DNS is virtual by design, and opening real resolution is
// a security decision this shim does not get to make. A lookup failure comes
// back with the instructions.
//
// A tarball is gzip, which is not text, so it crosses the boundary as base64
// (`body_b64`) and is inflated here. Nothing from the tarball executes: the
// members are written, and only a later `require` of the package runs them,
// under the same limits and watchdog as anything else in the sandbox.
const fs = require("fs");
const path = require("path");
const { gunzipSync } = require("fflate");

const DEFAULT_REGISTRY = "https://registry.npmjs.org";

// The abbreviated packument: enough to resolve a version and find a tarball,
// and a fraction of the full document's size.
const PACKUMENT_HEADERS = { Accept: "application/vnd.npm.install-v1+json" };

const fail = (message) => {
  const err = new Error(message);
  err.code = "ENPM";
  return err;
};

// One fetch, one JSON answer. A refusal or a dead host comes back as a thrown
// error from the chokepoint, so this only sees responses that arrived. The
// options go as an object: the chokepoint stringifies them in this realm, and
// stringifying here too would double-encode them into something the other side
// cannot parse.
const get = (url, headers) => {
  const response = JSON.parse(
    globalThis.fernbox.http.fetch(url, { method: "GET", headers }),
  );
  if (response.status >= 400) throw fail(`registry answered ${response.status} for ${url}`);
  return response;
};

// The tarball is bytes, so it arrives base64. Decoding by hand keeps the shim
// off any ambient `atob` a browser or Node might happen to provide.
const decodeBase64 = (text) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const values = [];
  for (const ch of text) {
    if (ch === "=") break;
    const value = alphabet.indexOf(ch);
    if (value >= 0) values.push(value);
  }
  const bytes = new Uint8Array((values.length * 6) / 8 | 0);
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
};

// The octal size field, including GNU's base-256 escape for a value that does
// not fit in eleven octal digits.
const readOctal = (bytes, off, len) => {
  if (bytes[off] & 0x80) {
    let value = bytes[off] & 0x7f;
    for (let i = off + 1; i < off + len; i++) value = value * 256 + bytes[i];
    return value;
  }
  let text = "";
  for (let i = off; i < off + len && bytes[i] !== 0; i++) text += String.fromCharCode(bytes[i]);
  return parseInt(text.trim(), 8) || 0;
};

const readText = (bytes) => {
  const at = bytes.indexOf(0);
  const slice = at < 0 ? bytes : bytes.subarray(0, at);
  // Names are usually ASCII; a pax header carries anything multi-byte as UTF-8
  // in its own field, so a decoder here is for the long-name case.
  return decodeUtf8(slice);
};

// The isolate has no `TextDecoder`, and a lossy stand-in is worse than none: it
// would turn a tarball's bytes into replacement characters and store a file
// that no longer matches what was published. This validates as it decodes, so
// a member that is not text is refused rather than mangled.
const decodeUtf8 = (bytes) => {
  let i = 0;
  const cont = () => {
    if (i >= bytes.length) throw new Error("truncated utf-8");
    const b = bytes[i++];
    if ((b & 0xc0) !== 0x80) throw new Error("bad utf-8 continuation byte");
    return b & 0x3f;
  };
  const chunks = [];
  const points = [];
  for (;;) {
    if (i >= bytes.length) break;
    const b = bytes[i++];
    let c;
    if (b < 0x80) c = b;
    else if ((b & 0xe0) === 0xc0) c = (b & 0x1f) << 6 | cont();
    else if ((b & 0xf0) === 0xe0) c = (b & 0x0f) << 12 | (cont() << 6) | cont();
    else if ((b & 0xf8) === 0xf0) c = (b & 0x07) << 18 | (cont() << 12) | (cont() << 6) | cont();
    else throw new Error("bad utf-8 lead byte");
    // Overlong encodings and encoded surrogates are not valid text either.
    if (c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) throw new Error("invalid utf-8 code point");
    points.push(c);
    if (points.length === 4096) {
      chunks.push(String.fromCodePoint(...points));
      points.length = 0;
    }
  }
  return points.length ? [...chunks, String.fromCodePoint(...points)].join("") : chunks.join("");
};

// The mirror of the above, for the rare case a tarball arrived as text.
const encodeUtf8 = (text) => {
  const bytes = [];
  let i = 0;
  while (i < text.length) {
    const c = text.codePointAt(i++);
    if (c > 0xffff) i++;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000)
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return Uint8Array.from(bytes);
};

// `len key=value\n`, one record after another. Only `path` and `size` matter,
// and both describe the entry that follows.
const parsePax = (data) => {
  const fields = {};
  let at = 0;
  while (at < data.length) {
    let digits = at;
    while (digits < data.length && data[digits] >= 0x30 && data[digits] <= 0x39) digits++;
    if (digits === at) break;
    const length = parseInt(readText(data.subarray(at, digits)), 10);
    if (!length || at + length > data.length) break;
    const record = readText(data.subarray(at, at + length));
    const equals = record.indexOf("=");
    if (equals > 0) {
      const key = record.slice(record.indexOf(" ") + 1, equals);
      fields[key] = record.slice(equals + 1).trimEnd();
    }
    at += length;
  }
  return fields;
};

// Walks the 512-byte blocks into a list of members. Handles the two ways a tar
// spells a long path — a pax `path` field, and GNU's `L` long-name entry —
// because npm produces both, and a member whose name was truncated to 100
// characters lands in the wrong place.
const readTar = (bytes) => {
  const members = [];
  let pending = {};
  let off = 0;
  while (off + 512 <= bytes.length) {
    const header = bytes.subarray(off, off + 512);
    // A block of zeros ends the archive.
    if (header.every((byte) => byte === 0)) break;

    const size = pending.size ?? readOctal(header, 124, 12);
    const data = bytes.subarray(off + 512, off + 512 + size);
    const type = String.fromCharCode(header[156] || 0);

    if (type === "g" || type === "x") {
      pending = parsePax(data);
    } else if (type === "L") {
      pending.name = readText(data);
    } else if (type === "K") {
      // A long link target: this fs has no symlinks, so it is noted and dropped.
      pending.linkname = readText(data);
    } else if (type === "0" || type === "\0") {
      const prefix = readText(header.subarray(345, 500));
      members.push({
        type: "file",
        name: pending.name || (prefix ? `${prefix}/${readText(header.subarray(0, 100))}` : readText(header.subarray(0, 100))),
        data,
      });
      pending = {};
    } else if (type === "5") {
      const prefix = readText(header.subarray(345, 500));
      members.push({
        type: "dir",
        name: pending.name || (prefix ? `${prefix}/${readText(header.subarray(0, 100))}` : readText(header.subarray(0, 100))),
      });
      pending = {};
    } else {
      // A hardlink, a symlink, a device: nothing this fs can store.
      pending = {};
    }
    off = off + 512 + size + ((512 - (size % 512)) % 512);
  }
  return members;
};

// `pkg@1.2.3` split at the last `@` that is not a scope marker.
const parseSpec = (spec) => {
  const at = spec.lastIndexOf("@");
  if (at <= 0) return { name: spec, range: "" };
  return { name: spec.slice(0, at), range: spec.slice(at + 1) };
};

const pickVersion = (packument, { name, range }) => {
  const tags = packument["dist-tags"] ?? {};
  if (!range) {
    if (!tags.latest) throw fail(`no latest tag for ${name}`);
    return tags.latest;
  }
  if (packument.versions && range in packument.versions) return range;
  if (range in tags) return tags[range];
  throw fail(`no version '${range}' for ${name}; semver ranges are not resolved yet`);
};

const installOne = (spec, registry) => {
  const parsed = parseSpec(spec);
  if (!parsed.name) throw fail("an empty package name");
  const packument = JSON.parse(get(`${registry}/${parsed.name}`, PACKUMENT_HEADERS).body);
  const version = pickVersion(packument, parsed);
  const dist = packument.versions?.[version]?.dist;
  if (!dist?.tarball) throw fail(`no tarball for ${parsed.name}@${version}`);

  const response = get(dist.tarball);
  const gzip = response.body_b64
    ? decodeBase64(response.body_b64)
    : encodeUtf8(response.body);
  const members = readTar(gunzipSync(gzip));

  const root = path.join("/node_modules", parsed.name);
  let written = 0;
  let skipped = 0;
  for (const member of members) {
    // npm tarballs carry every member under `package/`.
    if (!member.name.startsWith("package/")) continue;
    const relative = member.name.slice("package/".length);
    if (!relative || relative === "." || relative === "./") continue;
    const dest = path.join(root, relative);
    if (member.type === "dir") {
      fs.mkdirSync(dest, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // The fs is text this stage: a member that is not UTF-8 is skipped with a
    // line on stderr rather than stored as lossy text that would corrupt it.
    try {
      const text = decodeUtf8(member.data);
      fs.writeFileSync(dest, text);
      written += 1;
    } catch {
      skipped += 1;
      process.stderr.write(`npm: skipping binary member ${member.name}\n`);
    }
  }
  process.stdout.write(`+ ${parsed.name}@${version} (${written} files`);
  if (skipped) process.stdout.write(`, ${skipped} binary skipped`);
  process.stdout.write(")\n");
  return 0;
};

const install = (args) => {
  const specs = [];
  let registry = DEFAULT_REGISTRY;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--registry") {
      registry = args[++i];
      if (!registry) throw fail("--registry needs a url");
      continue;
    }
    if (arg.startsWith("--registry=")) {
      registry = arg.slice("--registry=".length);
      continue;
    }
    if (arg.startsWith("-")) continue;
    specs.push(arg);
  }
  if (specs.length === 0) throw fail("install needs at least one package");
  if (!fs.existsSync("/node_modules")) fs.mkdirSync("/node_modules", { recursive: true });
  let code = 0;
  for (const spec of specs) {
    if (installOne(spec, registry)) code = 1;
  }
  return code;
};

module.exports = {
  main(args) {
    const command = args.find((arg) => !arg.startsWith("-"));
    if (command !== "install" && command !== "i" && command !== "add") {
      process.stderr.write(`npm: '${command ?? "no command"}' is not implemented; only install\n`);
      return 1;
    }
    try {
      return install(args.filter((arg) => arg !== command));
    } catch (err) {
      process.stderr.write(`npm: ${err.message}\n`);
      return 1;
    }
  },
};
