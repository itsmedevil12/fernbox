// The simulated shell: a tokenizer, a small grammar, and a runner that executes
// the `/bin` shims.
//
// "Simulated" is the operative word. There is no process here: a child is a
// shim's `main(args)` invoked in this same context with `process.stdout` and
// `stderr` swapped onto capturing sinks, which is exactly the trust level
// `require("/bin/ls.js")` already had. No new privileged surface exists beneath
// this file — every write still goes through the frozen `fernbox` chokepoint —
// and the real isolation model is still the virtual-process stage's to build.
//
// Pipes are batch rather than streaming: a stage's captured stdout is handed to
// the next stage as its stdin. There is no fd layer to fake, and a pipeline's
// own output is the last stage's.

import { makeStdin } from "./stdin.js";
import { loadCommand } from "./require.js";
import { COMMAND_DIRS } from "./commands.js";
import { isAbsolute, join } from "./builtins/path.js";
import { appendFileSync, existsSync, statSync, writeFileSync } from "./builtins/fs.js";

// `sh -c "sh -c 'sh ...'"` is a recursion this grammar allows and the heap would
// rather not pay for in a stack overflow, which would surface as a `RangeError`
// that looks like a crash. The deadline bounds it in time; this bounds it in
// space.
const MAX_DEPTH = 16;
let depth = 0;

const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// A syntax error is a shell's complaint, not a thrown JS error: `run` answers a
// status, and status 2 is what bash reports for a bad command line.
const syntax = (at) => {
  const err = new Error(`syntax error near unexpected token ${at}`);
  err.status = 2;
  return err;
};

// Splits a line into words and operators. Quotes and escapes are only special
// when unquoted, and an operator inside quotes is data — the way an author
// expects `echo "a | b"` to print a pipe.
const tokenize = (line) => {
  const tokens = [];
  let word = null;
  let quote = null;

  const flush = () => {
    if (word !== null) {
      tokens.push(word);
      word = null;
    }
  };

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (quote) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      // Inside double quotes a backslash only escapes itself and the quote;
      // anything else is a literal backslash. In single quotes, all is literal.
      if (ch === "\\" && quote === '"') {
        const next = line[i + 1];
        if (next === '"' || next === "\\") {
          word += next;
          i++;
          continue;
        }
      }
      word += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      word ??= "";
      quote = ch;
      continue;
    }

    if (ch === "\\") {
      const next = line[i + 1];
      if (next !== undefined) {
        word ??= "";
        word += next;
        i++;
      }
      continue;
    }

    // A comment runs to the end of the line, but only from a word boundary.
    if (ch === "#" && word === null) break;

    if (ch === " " || ch === "\t" || ch === "\n") {
      flush();
      continue;
    }

    // The fd-prefixed forms are only recognised at a word boundary, so `a2>b`
    // is a word and a plain redirect, not `a2` with fd 2.
    if (ch === "2" && word === null && line[i + 1] === ">") {
      if (line.slice(i, i + 4) === "2>&1") {
        tokens.push({ op: "2>&1" });
        i += 3;
        continue;
      }
      if (line.slice(i, i + 3) === "2>>") {
        tokens.push({ op: "2>>" });
        i += 2;
        continue;
      }
      tokens.push({ op: "2>" });
      i += 1;
      continue;
    }

    const two = line.slice(i, i + 2);
    if (two === "&&" || two === "||" || two === ">>") {
      flush();
      tokens.push({ op: two });
      i += 1;
      continue;
    }

    if (ch === ">" || ch === "<" || ch === "|" || ch === ";") {
      flush();
      tokens.push({ op: ch });
      continue;
    }

    word ??= "";
    word += ch;
  }

  if (quote) throw syntax(`'${quote}'`);
  flush();
  return tokens;
};

// A list of commands joined by `;`, `&&` or `||`, each a list of stages joined
// by `|`. The connector describes how a command is joined to the next, which is
// what makes `&&` short-circuit on the status of the command before it.
const parse = (tokens) => {
  const newCommand = () => ({ stages: [{ words: [], redirects: [] }], connector: ";" });
  const commands = [];
  let cmd = newCommand();
  commands.push(cmd);
  let stage = cmd.stages[0];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (typeof token === "string") {
      stage.words.push(token);
      continue;
    }
    switch (token.op) {
      case "|":
        if (!stage.words.length) throw syntax("`|'");
        stage = { words: [], redirects: [] };
        cmd.stages.push(stage);
        break;
      case ";":
      case "&&":
      case "||":
        if (!stage.words.length && !stage.redirects.length) throw syntax(`'${token.op}'`);
        cmd.connector = token.op;
        cmd = newCommand();
        commands.push(cmd);
        stage = cmd.stages[0];
        break;
      case ">":
      case ">>":
      case "2>":
      case "2>>":
      case "<": {
        const target = tokens[++i];
        if (typeof target !== "string") throw syntax(`'${token.op}'`);
        stage.redirects.push({ kind: token.op, target });
        break;
      }
      case "2>&1":
        stage.redirects.push({ kind: "2>&1" });
        break;
      default:
        throw syntax(`'${token.op}'`);
    }
  }

  // A trailing operator leaves an empty command behind, which is nothing to run.
  const last = commands[commands.length - 1];
  if (last.stages.length === 1 && !last.stages[0].words.length && !last.stages[0].redirects.length)
    commands.pop();
  return commands;
};

// A bare name is looked up in the command directories the way a PATH lookup
// finds a command, and a path is used as spelled. `cwd` is consulted first, so
// an app's own file can shadow a command — same realm, same privilege, as with
// any image file.
const resolveCommand = (name, cwd) => {
  const bases = isAbsolute(name)
    ? [name]
    : [join(cwd, name), ...COMMAND_DIRS.map((dir) => join(dir, name))];
  for (const base of bases) {
    for (const candidate of [base, `${base}.js`]) {
      if (existsSync(candidate) && !isDir(candidate)) return candidate;
    }
  }
  return null;
};

// The commands that are the shell's own, because they change state a child
// cannot: `cd` moves this shell's directory, which a child process could not do
// for it. They mutate the `state` the runner shares with the whole command line,
// so a `cd` in one command is seen by the next.
const builtins = {
  cd(args, state) {
    const dir = state.chdir(args[0] ?? "/");
    if (dir === null) {
      process.stderr.write(`cd: ${args[0] ?? "/"}: No such file or directory\n`);
      return 1;
    }
    return 0;
  },
  pwd(_args, state) {
    process.stdout.write(`${state.cwd}\n`);
    return 0;
  },
  exit(args, state) {
    state.exited = true;
    // The tokenizer hands up strings, so the code is parsed rather than trusted
    // to be a number already.
    const code = Number(args[0]);
    state.exitCode = Number.isFinite(code) ? code : 0;
    // Ends this stage the way it ends a script: as a status, not a crash.
    process.exit(state.exitCode);
    return state.exitCode;
  },
  true: () => 0,
  false: () => 1,
};

// Runs one stage with the streams captured. Everything that can go wrong is a
// status: an unknown command is 127, a shim that cannot run is 126, and a throw
// is 1 with the message on stderr, because `execSync`'s contract is a result
// rather than an exception.
const runStage = (stage, { stdin, state, env }) => {
  const proc = globalThis.process;
  const cwd = state.cwd;
  const captured = { stdout: "", stderr: "" };
  const sink = (which) => ({
    write: (text) => {
      captured[which] += String(text);
      return true;
    },
    isTTY: false,
  });

  // Redirects are resolved before the command runs, in the order they were
  // written: `cmd 2>&1 > f` merges stderr into the pipe and then sends the pipe
  // to the file, and `cmd > f 2>&1` sends both to the file. `pipe` is the
  // stage's own stream; `merge` means stderr joins stdout. When both point at a
  // file the stderr copy appends, so it lands after stdout.
  let outTarget = "pipe";
  let errTarget = "pipe";
  let input = stdin;
  for (const redirect of stage.redirects) {
    switch (redirect.kind) {
      case ">":
        outTarget = { file: redirect.target, append: false };
        break;
      case ">>":
        outTarget = { file: redirect.target, append: true };
        break;
      case "2>":
        errTarget = { file: redirect.target, append: false };
        break;
      case "2>>":
        errTarget = { file: redirect.target, append: true };
        break;
      case "2>&1":
        errTarget = outTarget === "pipe" ? "merge" : { file: outTarget.file, append: true };
        break;
      case "<": {
        try {
          input = readFileSync(redirect.target, "utf8");
        } catch {
          return {
            stdout: "",
            stderr: `sh: ${redirect.target}: No such file or directory\n`,
            status: 1,
          };
        }
        break;
      }
      default:
        break;
    }
  }

  const prev = {
    out: proc.stdout,
    err: proc.stderr,
    in: proc.stdin,
    cwd: proc.cwd(),
    env: proc.env,
    code: proc.exitCode,
  };

  proc.stdout = sink("stdout");
  proc.stderr = sink("stderr");
  proc.stdin = makeStdin(input ?? "");
  try {
    proc.chdir(cwd);
  } catch {
    /* a stage's cwd is the shell's own, already validated by the `cd` that set it */
  }
  if (env) proc.env = { ...prev.env, ...env };

  let status = 0;
  try {
    if (stage.words.length === 0) {
      // A stage with redirects and no command, like `> f`: the file is made and
      // nothing runs.
      status = 0;
    } else {
      const [name, ...args] = stage.words;
      const builtin = builtins[name];
      if (builtin) {
        const code = builtin(args, state);
        status = typeof code === "number" ? code : 0;
      } else {
        const resolved = resolveCommand(name, cwd);
        if (!resolved) {
          proc.stderr.write(`sh: ${name}: command not found\n`);
          status = 127;
        } else {
          // `process.exit` inside a child throws a coded error after setting the
          // shared process's `exitCode`; that value is the child's status, and
          // the snapshot restored below keeps it from outliving the child. The
          // loader is the unrestricted one: an app cannot `require` a command,
          // and this is the path that runs one.
          const mod = loadCommand(resolved);
          const main = mod?.main;
          if (typeof main !== "function") {
            proc.stderr.write(`sh: ${name}: cannot execute\n`);
            status = 126;
          } else {
            const code = main(args);
            status = typeof code === "number" ? code : 0;
          }
        }
      }
    }
  } catch (err) {
    if (err?.code === "EXIT") {
      status = proc.exitCode;
    } else if (typeof err?.status === "number") {
      // A nested command's failure carries its own status, and that is the
      // honest one to report up: 126 for a recursion cap, 127 for a command a
      // subshell could not find. Flattening it to 1 would make every nested
      // failure look like a crash.
      status = err.status;
      proc.stderr.write(`${err.message ?? String(err)}\n`);
    } else {
      proc.stderr.write(`sh: ${stage.words[0] ?? ""}: ${err?.message ?? String(err)}\n`);
      status = 1;
    }
  } finally {
    proc.stdout = prev.out;
    proc.stderr = prev.err;
    proc.stdin = prev.in;
    proc.chdir(prev.cwd);
    proc.env = prev.env;
    proc.exitCode = prev.code;
  }

  const route = (target, text) => {
    if (target === "pipe" || target === "merge") return text;
    if (target.append) appendFileSync(target.file, text);
    else writeFileSync(target.file, text);
    return "";
  };

  let out = route(outTarget, captured.stdout);
  const err = route(errTarget, captured.stderr);
  if (errTarget === "merge") out += err;
  return { stdout: out, stderr: errTarget === "merge" ? "" : err, status };
};

// A pipeline is stage after stage, each one's stdout the next one's stdin. The
// state is shared, so a `cd` partway through moves the stages that follow.
const runPipeline = (stages, context) => {
  let stdout = context.stdin ?? "";
  let stderr = "";
  let status = 0;
  for (const stage of stages) {
    const result = runStage(stage, { ...context, stdin: stdout });
    stdout = result.stdout;
    stderr += result.stderr;
    status = result.status;
  }
  return { stdout, stderr, status };
};

// Runs a list of commands and never throws: a shell reports failure as a status.
// `cwd` and `exited` come back because a `cd` moved the directory and `exit`
// ended the shell, and a caller driving a prompt loop wants both.
const runCommands = (commands, options = {}) => {
  if (depth >= MAX_DEPTH)
    return {
      stdout: "",
      stderr: "sh: maximum recursion depth exceeded\n",
      status: 126,
      cwd: options.cwd ?? "/",
      exited: true,
    };
  depth++;
  const state = {
    cwd: options.cwd ?? globalThis.process.cwd(),
    chdir(target) {
      const dir = isAbsolute(target) ? target : join(this.cwd, target);
      if (!isDir(dir)) return null;
      this.cwd = dir;
      return dir;
    },
    exited: false,
    exitCode: 0,
  };
  try {
    let stdout = "";
    let stderr = "";
    let status = 0;
    for (let i = 0; i < commands.length; i++) {
      const previous = commands[i - 1];
      // `&&` and `||` are conditional on the command before them; `;` always
      // runs.
      if (previous?.connector === "&&" && status !== 0) continue;
      if (previous?.connector === "||" && status === 0) continue;

      const result = runPipeline(commands[i].stages, {
        state,
        stdin: options.stdin,
        env: options.env,
      });
      // Accumulated, the way one terminal sees the output of every command that
      // ran: the last one's status is the line's, but its output is not all of
      // it.
      stdout += result.stdout;
      stderr += result.stderr;
      status = result.status;
      if (state.exited) break;
    }
    return {
      stdout,
      stderr,
      status: state.exited ? state.exitCode : status,
      cwd: state.cwd,
      exited: state.exited,
    };
  } finally {
    depth--;
  }
};

// A command line, with the grammar: quotes, operators, the lot.
export const run = (line, options = {}) => {
  let tokens;
  try {
    tokens = tokenize(line);
  } catch (err) {
    return { stdout: "", stderr: `${err.message}\n`, status: err.status ?? 2, cwd: options.cwd ?? globalThis.process.cwd() };
  }
  if (!tokens.length) return { stdout: "", stderr: "", status: 0, cwd: options.cwd ?? globalThis.process.cwd() };
  try {
    return runCommands(parse(tokens), options);
  } catch (err) {
    return { stdout: "", stderr: `${err.message}\n`, status: err.status ?? 2, cwd: options.cwd ?? globalThis.process.cwd() };
  }
};

// One command with a prepared argv and no grammar in between — the shape
// `execFileSync` wants, where an argument that looks like an operator is data
// and not a pipe.
export const runArgv = (file, args, options = {}) =>
  runCommands([{ stages: [{ words: [file, ...args], redirects: [] }], connector: ";" }], options);
