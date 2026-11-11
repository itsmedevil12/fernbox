// The `fs` builtin: a text-oriented filesystem with Node's sync, callback, and
// promise shapes.
//
// Every call crosses the two-context boundary as strings and comes back as JSON
// text, which is why the surface looks the way it does: `fernbox.fs.stat`
// answers `'{"type":"dir","size":0}'` and this module is the one place that
// turns it back into an object — built here, in the user realm, so no object
// ever crosses the boundary itself.
//
// A refusal arrives as `{"error":"ENOENT","message":"..."}` rather than a
// throw, so the builtin can rethrow it carrying the code: a caller's `catch`
// sees `e.code === "ENOENT"`, the way it does under Node.
//
// The callback and promise forms run the synchronous chokepoint and defer the
// answer by a tick. There is no asynchronous storage behind the virtual fs, so
// that is the truthful shape: the ordering is Node's, the parallelism is not.
import { Readable } from "./stream.js";
import { normalize } from "./path.js";

const api = () => globalThis.fernbox.fs;

function unwrap(json, what) {
  const r = JSON.parse(json);
  if (r.error) {
    const err = new Error(r.message ?? `${r.error}: ${what}`);
    err.code = r.error;
    throw err;
  }
  return r;
}

const enoent = (p) => {
  const err = new Error(`ENOENT: no such file or directory, open '${p}'`);
  err.code = "ENOENT";
  return err;
};

// Run a sync implementation, reporting through a Node-style callback on the
// next tick. A caller that passes no callback gets the error thrown, the way
// Node's callback-less misuse does.
function async_(work, callback) {
  if (typeof callback !== "function") {
    const err = new TypeError("The callback argument must be of type function");
    err.code = "ERR_INVALID_ARG_TYPE";
    throw err;
  }
  let result;
  try {
    result = work();
  } catch (err) {
    process.nextTick(() => callback(err));
    return;
  }
  process.nextTick(() => callback(null, result));
}

export function readFileSync(p, _options) {
  // `read` hands back the contents themselves rather than an envelope, because
  // a missing file is the one expected failure and null is a cheaper signal
  // than a JSON error object. This is the only place that cost is paid back.
  const text = globalThis.fernbox.read(p);
  if (text === null || text === undefined) throw enoent(p);
  return text;
}

export function writeFileSync(p, data) {
  globalThis.fernbox.write(p, data === null || data === undefined ? "" : String(data));
}

export function appendFileSync(p, data) {
  const prev = globalThis.fernbox.read(p);
  globalThis.fernbox.write(p, (prev ?? "") + (data === null || data === undefined ? "" : String(data)));
}

export function mkdirSync(p, options) {
  // The object crosses as itself and the chokepoint stringifies it in this
  // realm; stringifying here too would double-encode, and the parse on the
  // other side would hand back the text rather than the options.
  unwrap(api().mkdir(p, options ?? {}), `mkdir '${p}'`);
}

export function readdirSync(p) {
  return JSON.parse(api().readdir(p));
}

export function existsSync(p) {
  // Already a boolean on the chokepoint's other side, so it comes through as
  // one and needs no envelope.
  return api().exists(p);
}

export function statSync(p) {
  const st = unwrap(api().stat(p), `stat '${p}'`);
  const dir = st.type === "dir";
  const size = st.size ?? 0;
  // The virtual filesystem stores contents, not metadata, so it has no durable
  // timestamps. Reporting the moment of the stat keeps conditional requests
  // honest: a file is never claimed to be older than the asker's copy.
  const now = new Date();
  return {
    size,
    dev: 0,
    ino: 0,
    mode: dir ? 0o40755 : 0o100644,
    nlink: 1,
    uid: 1000,
    gid: 1000,
    rdev: 0,
    blksize: 4096,
    blocks: Math.ceil(size / 512),
    atime: now,
    mtime: now,
    ctime: now,
    birthtime: now,
    atimeMs: now.getTime(),
    mtimeMs: now.getTime(),
    ctimeMs: now.getTime(),
    birthtimeMs: now.getTime(),
    // The two questions a caller actually asks, and the one a `readdir`
    // consumer needs to distinguish them with.
    isDirectory: () => dir,
    isFile: () => !dir,
    isSymbolicLink: () => false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  };
}

export function unlinkSync(p) {
  unwrap(api().unlink(p), `unlink '${p}'`);
}

export function rmdirSync(p) {
  unwrap(api().rmdir(p), `rmdir '${p}'`);
}

export function renameSync(from, to) {
  unwrap(api().rename(from, to), `rename '${from}' -> '${to}'`);
}

// There are no symlinks to follow; a path already is the file it names.
export function realpathSync(p) {
  if (!existsSync(p)) throw enoent(p);
  return normalize(p);
}

// --- callback shape ----------------------------------------------------------

export function readFile(p, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  async_(() => readFileSync(p, options), callback);
}

export function writeFile(p, data, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  async_(() => writeFileSync(p, data), callback);
}

export function appendFile(p, data, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  async_(() => appendFileSync(p, data), callback);
}

export function mkdir(p, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  async_(() => mkdirSync(p, options), callback);
}

export function readdir(p, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  async_(() => readdirSync(p), callback);
}

export function stat(p, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  async_(() => statSync(p), callback);
}

export function unlink(p, callback) {
  async_(() => unlinkSync(p), callback);
}

export function rmdir(p, callback) {
  async_(() => rmdirSync(p), callback);
}

export function rename(from, to, callback) {
  async_(() => renameSync(from, to), callback);
}

export function realpath(p, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  async_(() => realpathSync(p), callback);
}

// `access` answers only "does it exist": read access is the sandbox's default,
// and write access is the fs policy's call at the write itself.
export function access(p, mode, callback) {
  if (typeof mode === "function") {
    callback = mode;
    mode = undefined;
  }
  async_(
    () => {
      if (!existsSync(p)) throw enoent(p);
    },
    callback,
  );
}

// The deprecated shape: a boolean, never an error. It must not throw, so it
// goes through `existsSync` inside a try.
export function exists(p, callback) {
  if (typeof callback !== "function") return;
  let answer = false;
  try {
    answer = existsSync(p);
  } catch {
    answer = false;
  }
  process.nextTick(() => callback(answer));
}

export const constants = {
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  X_OK: 1,
  COPYFILE_EXCL: 1,
  O_RDONLY: 0,
  O_WRONLY: 1,
  O_RDWR: 2,
  O_CREAT: 64,
  O_TRUNC: 512,
  O_APPEND: 1024,
  S_IFMT: 0o170000,
  S_IFDIR: 0o040000,
  S_IFREG: 0o100000,
};

// --- streams -----------------------------------------------------------------

/** A Readable over one text file. The whole file is read when the stream is
 * first pulled, and the optional `start`/`end` (inclusive, as under Node)
 * select a byte range — which is what static-file range requests need. */
export class ReadStream extends Readable {
  constructor(p, options = {}) {
    super({ autoDestroy: true, emitClose: true, encoding: options.encoding });
    this.path = String(p);
    this.start = options.start ?? 0;
    this.end = options.end;
    this.bytesRead = 0;
    this.fd = null;
    this._started = false;
    this._contents = null;
    this._error = null;
    try {
      this._contents = readFileSync(this.path);
    } catch (err) {
      this._error = err;
    }
  }

  _read() {
    if (this._started) return;
    this._started = true;
    // Opening is asynchronous under Node, so an ENOENT must not reach the
    // caller before its 'error' listener is attached.
    process.nextTick(() => {
      if (this._error) {
        this.destroy(this._error);
        return;
      }
      this.fd = 0;
      this.emit("open", 0);
      const bytes = Buffer.from(this._contents);
      const last = this.end === undefined ? bytes.length - 1 : Math.min(this.end, bytes.length - 1);
      const slice = this.start <= last ? bytes.subarray(this.start, last + 1) : Buffer.alloc(0);
      this.bytesRead = slice.length;
      if (slice.length > 0) this.push(slice);
      this.push(null);
    });
  }

  close(callback) {
    if (typeof callback === "function") this.once("close", callback);
    this.destroy();
  }
}

export function createReadStream(p, options) {
  return new ReadStream(p, options);
}

// --- promise shape -----------------------------------------------------------

const promisify = (fn) => (...args) =>
  new Promise((resolve, reject) => {
    fn(...args, (err, value) => (err ? reject(err) : resolve(value)));
  });

export const promises = {
  readFile: promisify(readFile),
  writeFile: promisify(writeFile),
  appendFile: promisify(appendFile),
  mkdir: promisify(mkdir),
  readdir: promisify(readdir),
  stat: promisify(stat),
  unlink: promisify(unlink),
  rmdir: promisify(rmdir),
  rename: promisify(rename),
  realpath: promisify(realpath),
  access: promisify(access),
  constants,
};
