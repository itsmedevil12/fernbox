// `process`, built from the identity the host injected before the boot bundle
// ran. Every value here describes the virtual process; the host's own
// environment and argv never reach it, because the caller's are the whole of
// what the sandbox sees.

import { makeStdin } from "./stdin.js";
import { resolve } from "./builtins/path.js";

// The one cwd this process has. It is module state rather than a constant
// because a shell's `cd` has to move it, and everything that resolves a
// relative path — `require` from a script, `ls` with no argument — reads it
// back through `process.cwd()`.
let cwd = "/";

export function makeProcess() {
  const argv = globalThis.__fernbox_argv ?? ["node", "/main.js"];
  const env = {};
  for (const pair of globalThis.__fernbox_env ?? []) {
    // A real environment splits on the first `=` only, so a value may itself
    // contain one.
    const at = pair.indexOf("=");
    if (at > 0) env[pair.slice(0, at)] = pair.slice(at + 1);
  }

  const write = (which) => (text) => {
    globalThis.fernbox.stdio.write(String(text), which);
    return true;
  };

  // The highest-resolution clock the realm has is `Date.now()`'s millisecond
  // one, so the nanosecond fields are milliseconds scaled. The shape is what
  // matters: libraries measure elapsed time with it (pino calls `bigint()` at
  // import), and a run's own budget is enforced outside the realm.
  const hrtime = function hrtime(previous) {
    const now = BigInt(Math.round(Date.now())) * 1000000n;
    if (!previous) return [Number(now / 1000000000n), Number(now % 1000000000n)];
    const base = BigInt(previous[0]) * 1000000000n + BigInt(previous[1]);
    const elapsed = now - base;
    return [Number(elapsed / 1000000000n), Number(elapsed % 1000000000n)];
  };
  hrtime.bigint = () => BigInt(Math.round(Date.now())) * 1000000n;

  const self = {
    // `["node", entrypoint, ...args]`, so `argv.slice(2)` behaves.
    argv,
    argv0: argv[0] ?? "node",
    env,
    // The virtual process is the only one there is.
    pid: 1,
    ppid: 0,
    platform: "linux",
    arch: "x64",
    title: "node",
    cwd: () => cwd,
    // A real `chdir` fails on a directory that is not there, and so does this
    // one: a silent move to a path that does not exist would make every later
    // relative resolution quietly point somewhere else.
    chdir(dir) {
      if (typeof dir !== "string" || dir === "")
        throw new Error("chdir: path must be a non-empty string");
      const target = resolve(dir);
      const st = JSON.parse(globalThis.fernbox.fs.stat(target) ?? '{"type":"file"}');
      if (st.type !== "dir") {
        const err = new Error(`ENOENT: no such file or directory, chdir '${target}'`);
        err.code = "ENOENT";
        throw err;
      }
      cwd = target;
    },
    exitCode: 0,
    hrtime,
    uptime: () => 0,

    // Node writes warnings to its own stderr; so does this, rather than throwing
    // or dropping what a library wanted to tell the operator.
    emitWarning(warning, type) {
      const text = warning instanceof Error ? warning.message : String(warning);
      const name = typeof type === "string" ? type : "Warning";
      write("stderr")(`(node) ${name}: ${text}\n`);
    },
    _rawDebug(...args) {
      write("stderr")(`${args.map(String).join(" ")}\n`);
    },

    // A real exit code ends the process; nothing here can. Until the virtual
    // process lands, the best a script can get is a run that reports the code
    // it asked for, so `exit` records it and throws — the run comes back as a
    // `threw` carrying the number rather than silently succeeding.
    exit(code) {
      if (code !== undefined && code !== null) self.exitCode = code | 0;
      const err = new Error(`process.exit(${self.exitCode})`);
      err.code = "EXIT";
      throw err;
    },

    // Write-only: a script cannot read back what it printed, any more than a
    // program can read its own stdout pipe.
    stdout: { write: write("stdout"), isTTY: false },
    stderr: { write: write("stderr"), isTTY: false },

    // What the caller piped in, installed as identity before the boot bundle
    // ran. A terminal is never read — there is no way to know when the caller
    // is done typing — so this is empty unless something was piped. A child
    // gets its own over the `input` an `exec` hands it.
    stdin: makeStdin(globalThis.__fernbox_stdin ?? ""),

    // V8's microtask queue is available in the isolate, so this is a real
    // scheduler rather than a no-op — the same one `runtime/src/shim.js`
    // gives the system context.
    nextTick(cb, ...args) {
      Promise.resolve().then(() => cb(...args));
    },

    // The things a dependency probes at import time. Answering them here keeps
    // a `require` from failing on a feature check it will never exercise.
    versions: { node: "20.0.0", v8: "12.0.0" },
    browser: false,
    binding: () => {
      throw new Error("process.binding is not supported in the sandbox");
    },
    on: () => self,
    once: () => self,
    removeListener: () => self,
  };

  return self;
}
