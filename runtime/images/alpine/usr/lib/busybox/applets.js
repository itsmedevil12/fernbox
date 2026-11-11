// The applets behind the multi-call `busybox` binary and the `/bin` shims that
// stand in for the symlinks a real filesystem would carry. Each is a function
// `(args) => status` writing to the captured stdout and stderr a command always
// writes to, and each is reached the same way: a shim in `/bin` names it, or
// `busybox <applet>` runs it directly.
//
// They live under /usr/lib rather than in a command directory because a command
// file has to be able to require them, and `require` refuses a path under /bin
// or /usr/bin — the same rule that keeps an app from importing a command. This
// is the one userland that is not the base image's, deliberately: Alpine ships
// BusyBox where a common distribution ships coreutils, and the image is a
// different userland rather than a copy of the base one. The applets are the
// smaller versions, the way BusyBox's are.
const fs = require("fs");
const path = require("path");

// A trailing newline is not a line of its own, and empty input is no lines at
// all rather than one empty one.
const split = (text) => {
  const body = text.endsWith("\n") ? text.slice(0, -1) : text;
  return body === "" ? [] : body.split("\n");
};

const isDir = (target) => {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
};

// A bundle like `-rf` is one word that the real commands split into `r` and `f`,
// so the applets that take flags share one split: short flags expand into a set,
// a long flag maps to the short one it means, and whatever is left is the
// command's own. An unknown flag is not a flag anywhere here — it is a word the
// command will most likely not find, which is how a BusyBox tool answers one.
const parseFlags = (args, longs = {}) => {
  const flags = new Set();
  const words = [];
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const short = longs[arg.slice(2)];
      if (short) flags.add(short);
      else words.push(arg);
    } else if (arg.startsWith("-") && arg.length > 1) {
      for (const ch of arg.slice(1)) flags.add(ch);
    } else {
      words.push(arg);
    }
  }
  return { flags, words };
};

const applets = {
  echo(args) {
    let newline = true;
    const words = [];
    for (const arg of args) {
      if (arg === "-n" && words.length === 0) {
        newline = false;
        continue;
      }
      words.push(arg);
    }
    process.stdout.write(words.join(" "));
    if (newline) process.stdout.write("\n");
    return 0;
  },

  cat(args) {
    if (args.length === 0) {
      const input = process.stdin.read();
      if (input) process.stdout.write(input);
      return 0;
    }
    let code = 0;
    for (const file of args) {
      try {
        process.stdout.write(fs.readFileSync(file, "utf8"));
      } catch (err) {
        process.stderr.write(`cat: ${file}: ${err.code ?? "EIO"}\n`);
        code = 1;
      }
    }
    return code;
  },

  pwd() {
    process.stdout.write(`${process.cwd()}\n`);
    return 0;
  },

  true: () => 0,
  false: () => 1,

  ls(args) {
    const { flags, words: targets } = parseFlags(args, { all: "a" });
    const showAll = flags.has("a") || flags.has("A");
    const long = flags.has("l");
    if (targets.length === 0) targets.push(process.cwd());
    let code = 0;
    const many = targets.length > 1;
    for (const target of targets) {
      if (many) process.stdout.write(`${target}:\n`);
      if (!isDir(target)) {
        try {
          fs.statSync(target);
          process.stdout.write(`${path.basename(target)}\n`);
        } catch {
          process.stderr.write(`ls: cannot access '${target}': No such file or directory\n`);
          code = 1;
        }
        continue;
      }
      const names = fs.readdirSync(target).filter((n) => showAll || !n.startsWith(".")).sort();
      for (const name of names) {
        if (!long) {
          process.stdout.write(`${name}\n`);
          continue;
        }
        const st = fs.statSync(path.join(target, name));
        process.stdout.write(`${st.isDirectory() ? "d" : "-"} ${String(st.size).padStart(8)} ${name}\n`);
      }
    }
    return code;
  },

  mkdir(args) {
    const { flags, words: dirs } = parseFlags(args, { parents: "p" });
    const recursive = flags.has("p");
    if (dirs.length === 0) {
      process.stderr.write("mkdir: missing operand\n");
      return 1;
    }
    let code = 0;
    for (const dir of dirs) {
      try {
        fs.mkdirSync(dir, { recursive });
      } catch (err) {
        if (recursive && err.code === "EEXIST") continue;
        process.stderr.write(`mkdir: cannot create directory '${dir}': ${err.code}\n`);
        code = 1;
      }
    }
    return code;
  },

  rmdir(args) {
    let code = 0;
    for (const dir of args.filter((arg) => !arg.startsWith("-"))) {
      try {
        fs.rmdirSync(dir);
      } catch (err) {
        process.stderr.write(`rmdir: ${dir}: ${err.code ?? "EIO"}\n`);
        code = 1;
      }
    }
    return code;
  },

  rm(args) {
    const { flags, words: targets } = parseFlags(args, { recursive: "r", force: "f" });
    const recursive = flags.has("r") || flags.has("R");
    const force = flags.has("f");
    const remove = (target) => {
      if (fs.statSync(target).isFile()) {
        fs.unlinkSync(target);
        return;
      }
      if (!recursive) {
        const err = new Error(`cannot remove '${target}': Is a directory`);
        err.code = "EISDIR";
        throw err;
      }
      for (const name of fs.readdirSync(target)) remove(path.join(target, name));
      fs.rmdirSync(target);
    };
    let code = 0;
    for (const target of args.filter((arg) => !arg.startsWith("-"))) {
      try {
        remove(target);
      } catch (err) {
        if (force && err.code === "ENOENT") continue;
        process.stderr.write(`rm: ${err.message}\n`);
        code = 1;
      }
    }
    return code;
  },

  mv(args) {
    const targets = args.filter((arg) => !arg.startsWith("-"));
    if (targets.length < 2) {
      process.stderr.write("mv: missing destination file operand\n");
      return 1;
    }
    const [source, dest] = targets;
    if (isDir(dest)) {
      fs.renameSync(source, path.join(dest, path.basename(source)));
      return 0;
    }
    try {
      fs.renameSync(source, dest);
    } catch (err) {
      process.stderr.write(`mv: cannot move '${source}' to '${dest}': ${err.code}\n`);
      return 1;
    }
    return 0;
  },

  cp(args) {
    const { flags, words: targets } = parseFlags(args, { recursive: "r" });
    const recursive = flags.has("r") || flags.has("R");
    if (targets.length < 2) {
      process.stderr.write("cp: missing destination file operand\n");
      return 1;
    }
    const dest = targets[targets.length - 1];
    const into = isDir(dest);
    const copyTree = (source, target) => {
      if (!fs.statSync(source).isDirectory()) {
        fs.writeFileSync(target, fs.readFileSync(source, "utf8"));
        return;
      }
      fs.mkdirSync(target, { recursive: true });
      for (const name of fs.readdirSync(source)) {
        copyTree(path.join(source, name), path.join(target, name));
      }
    };
    let code = 0;
    for (const source of targets.slice(0, -1)) {
      const target = into ? path.join(dest, path.basename(source)) : dest;
      try {
        if (fs.statSync(source).isDirectory()) {
          if (!recursive) {
            const err = new Error(`cannot copy '${source}': Is a directory`);
            err.code = "EISDIR";
            throw err;
          }
          copyTree(source, target);
        } else {
          fs.writeFileSync(target, fs.readFileSync(source, "utf8"));
        }
      } catch (err) {
        process.stderr.write(`cp: cannot copy '${source}' to '${dest}': ${err.code ?? "EIO"}\n`);
        code = 1;
      }
    }
    return code;
  },

  touch(args) {
    const { flags, words: files } = parseFlags(args, { "no-create": "c" });
    const create = !flags.has("c");
    let code = 0;
    for (const file of files) {
      if (fs.existsSync(file) || !create) continue;
      try {
        fs.writeFileSync(file, "");
      } catch (err) {
        process.stderr.write(`touch: cannot touch '${file}': ${err.code ?? "EIO"}\n`);
        code = 1;
      }
    }
    return code;
  },

  head(args) {
    let n = 10;
    const files = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-n") {
        n = Number(args[++i]) || 10;
      } else if (!args[i].startsWith("-")) {
        files.push(args[i]);
      }
    }
    const sources = files.length === 0 ? [null] : files;
    let code = 0;
    for (const file of sources) {
      let text;
      if (file === null) text = process.stdin.read() ?? "";
      else {
        try {
          text = fs.readFileSync(file, "utf8");
        } catch {
          process.stderr.write(`head: cannot open '${file}' for reading\n`);
          code = 1;
          continue;
        }
      }
      const output = split(text).slice(0, n).join("\n");
      if (output) process.stdout.write(`${output}\n`);
    }
    return code;
  },

  tail(args) {
    let n = 10;
    const files = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-n") {
        n = Number(args[++i]) || 10;
      } else if (!args[i].startsWith("-")) {
        files.push(args[i]);
      }
    }
    const sources = files.length === 0 ? [null] : files;
    let code = 0;
    for (const file of sources) {
      let text;
      if (file === null) text = process.stdin.read() ?? "";
      else {
        try {
          text = fs.readFileSync(file, "utf8");
        } catch {
          process.stderr.write(`tail: cannot open '${file}' for reading\n`);
          code = 1;
          continue;
        }
      }
      const lines = split(text);
      const output = lines.slice(Math.max(0, lines.length - n)).join("\n");
      if (output) process.stdout.write(`${output}\n`);
    }
    return code;
  },

  sort(args) {
    const { flags, words: files } = parseFlags(args, { reverse: "r", unique: "u" });
    const reverse = flags.has("r");
    const unique = flags.has("u");
    let text = "";
    let code = 0;
    if (files.length === 0) {
      text = process.stdin.read() ?? "";
    } else {
      for (const file of files) {
        try {
          text += fs.readFileSync(file, "utf8");
        } catch {
          process.stderr.write(`sort: cannot read: ${file}\n`);
          code = 1;
        }
      }
    }
    let sorted = split(text).sort();
    if (reverse) sorted = sorted.reverse();
    if (unique) {
      const seen = new Set();
      sorted = sorted.filter((line) => !seen.has(line) && seen.add(line));
    }
    if (sorted.length) process.stdout.write(`${sorted.join("\n")}\n`);
    return code;
  },

  wc(args) {
    const { flags, words: files } = parseFlags(args, { lines: "l", words: "w", chars: "c" });
    const lines = flags.has("l");
    const words = flags.has("w");
    const chars = flags.has("c");
    const all = !lines && !words && !chars;
    const count = (text) => ({
      lines: split(text).length,
      words: text.trim() === "" ? 0 : text.trim().split(/\s+/).length,
      chars: text.length,
    });
    const report = (name, c) => {
      const parts = [];
      if (all || lines) parts.push(String(c.lines).padStart(7));
      if (all || words) parts.push(String(c.words).padStart(7));
      if (all || chars) parts.push(String(c.chars).padStart(7));
      process.stdout.write(`${parts.join(" ")}${name ? ` ${name}` : ""}\n`);
    };
    if (files.length === 0) {
      report("", count(process.stdin.read() ?? ""));
      return 0;
    }
    let code = 0;
    const total = { lines: 0, words: 0, chars: 0 };
    for (const file of files) {
      let text;
      try {
        text = fs.readFileSync(file, "utf8");
      } catch {
        process.stderr.write(`wc: ${file}: No such file or directory\n`);
        code = 1;
        continue;
      }
      const c = count(text);
      total.lines += c.lines;
      total.words += c.words;
      total.chars += c.chars;
      report(file, c);
    }
    if (files.length > 1) report("total", total);
    return code;
  },

  grep(args) {
    const { flags, words: positional } = parseFlags(args, {
      "ignore-case": "i",
      "invert-match": "v",
      "line-number": "n",
      count: "c",
    });
    const ignoreCase = flags.has("i");
    const invert = flags.has("v");
    const number = flags.has("n");
    const countOnly = flags.has("c");
    if (positional.length === 0) {
      process.stderr.write("grep: a pattern is required\n");
      return 2;
    }
    const [pattern, ...files] = positional;
    let re;
    try {
      re = new RegExp(pattern, ignoreCase ? "i" : "");
    } catch (err) {
      process.stderr.write(`grep: ${pattern}: ${err.message}\n`);
      return 2;
    }
    const sources = files.length === 0 ? [null] : files;
    const many = sources.length > 1;
    let code = 0;
    for (const file of sources) {
      let text;
      if (file === null) text = process.stdin.read() ?? "";
      else {
        try {
          text = fs.readFileSync(file, "utf8");
        } catch {
          process.stderr.write(`grep: ${file}: No such file or directory\n`);
          code = 2;
          continue;
        }
      }
      let hits = 0;
      split(text).forEach((line, i) => {
        if (re.test(line) === invert) return;
        hits++;
        if (countOnly) return;
        const tag = many ? `${file}:` : "";
        process.stdout.write(`${tag}${number ? `${i + 1}:` : ""}${line}\n`);
      });
      if (countOnly) process.stdout.write(`${hits}\n`);
      if (hits === 0) code = 1;
    }
    return code;
  },

  printenv(args) {
    if (args.length === 0) {
      for (const [key, value] of Object.entries(process.env)) {
        process.stdout.write(`${key}=${value}\n`);
      }
      return 0;
    }
    let code = 0;
    for (const name of args) {
      const value = process.env[name];
      if (value === undefined) {
        code = 1;
        continue;
      }
      process.stdout.write(`${value}\n`);
    }
    return code;
  },

  sh(args) {
    const shell = require("shell");
    const report = (result) => {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    };
    if (args.length !== 0) {
      const line = args[0] === "-c" ? args.slice(1).join(" ") : args.join(" ");
      const result = shell.run(line);
      report(result);
      return result.status;
    }
    let cwd = process.cwd();
    let code = 0;
    for (;;) {
      process.stderr.write("$ ");
      const line = process.stdin.readLine();
      if (line === null) break;
      const result = shell.run(line, { cwd });
      cwd = result.cwd;
      report(result);
      code = result.status;
      if (result.exited) break;
    }
    return code;
  },
};

module.exports = applets;
