// `child_process`, simulated.
//
// There is no process here: `execSync` is the shell's runner over a command
// line, and a child is a `/bin` shim invoked with its stdio captured. The
// contract is Node's — a returned stdout, a thrown error carrying `status` —
// because that is the shape an author writes against, and the virtual-process
// stage can replace the runner beneath it without changing a line of the code
// that calls this.
//
// A child is not isolated from its parent: same heap, same fs, same module
// cache, same deadline. It is the same trust level as `require`-ing the shim,
// which the app could already do.

import * as shell from "../shell.js";

// Node's error carries the pieces a caller needs to report what went wrong.
const fail = (command, result) => {
  const err = new Error(`Command failed: ${command}\n${result.stderr}`);
  err.status = result.status;
  err.stdout = result.stdout;
  err.stderr = result.stderr;
  return err;
};

const optionsOf = (options) => {
  const opts = options ?? {};
  return {
    cwd: typeof opts.cwd === "string" ? opts.cwd : undefined,
    env: opts.env && typeof opts.env === "object" ? opts.env : undefined,
    // The runner calls it `stdin`; Node calls the option `input`, so it is
    // renamed here at the one place the two vocabularies meet.
    stdin: typeof opts.input === "string" ? opts.input : "",
  };
};

export function execSync(command, options) {
  if (typeof command !== "string" || command === "")
    throw new Error("execSync: command must be a non-empty string");
  const result = shell.run(command, optionsOf(options));
  if (result.status !== 0) throw fail(command, result);
  return result.stdout;
}

// No shell, no grammar: the file is a command and the args are its argv, so an
// argument that looks like an operator is data.
export function execFileSync(file, args, options) {
  if (typeof file !== "string" || file === "")
    throw new Error("execFileSync: file must be a non-empty string");
  const argv = Array.isArray(args) ? args.map(String) : [];
  const result = shell.runArgv(file, argv, optionsOf(options));
  if (result.status !== 0) throw fail(file, result);
  return result.stdout;
}

// The same runner, drained on the microtask queue, so a callback sees a result
// rather than the stack that asked for it. A shim that writes from a timer after
// its `main` returns is the case this cannot capture synchronously; the drain
// is why the callback is async at all.
export function exec(command, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  const cb = typeof callback === "function" ? callback : () => {};
  const opts = optionsOf(options);
  Promise.resolve().then(() => {
    let result;
    try {
      result = shell.run(command, opts);
    } catch (err) {
      cb(err, "", "");
      return;
    }
    if (result.status !== 0) cb(fail(command, result), result.stdout, result.stderr);
    else cb(null, result.stdout, result.stderr);
  });
}
// These promise a `ChildProcess` with live streams, which is a process object
// the sandbox does not have yet. Named rather than absent, so the failure says
// what is missing instead of "cannot find module".
const notImplemented = (name) => () => {
  throw new Error(`not implemented: child_process.${name}; virtual processes land later`);
};

export const spawn = notImplemented("spawn");
export const spawnSync = notImplemented("spawnSync");
export const fork = notImplemented("fork");
