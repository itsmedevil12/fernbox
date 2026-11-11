// `tail`. The last N lines, which means the whole file is held in memory — the
// same batch model a pipeline already has, and the reason a stream here would be
// a different command rather than a flag. Counts are spelled the way `head`
// spells them.
const fs = require("fs");

const parse = (args) => {
  let n = 10;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-n") {
      n = Number(args[++i]);
    } else if (/^-\d+$/.test(arg)) {
      n = Number(arg.slice(1));
    } else if (arg.startsWith("--lines=")) {
      n = Number(arg.slice(8));
    } else {
      files.push(arg);
    }
  }
  return { n: Number.isFinite(n) ? n : 10, files };
};

const linesOf = (text) => (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");

module.exports = {
  main(args) {
    const { n, files } = parse(args);
    if (files.length === 0) files.push(null);
    let code = 0;
    const many = files.length > 1;
    for (const file of files) {
      let text;
      if (file === null) {
        text = process.stdin.read() ?? "";
      } else {
        try {
          text = fs.readFileSync(file, "utf8");
        } catch {
          process.stderr.write(`tail: cannot open '${file}' for reading: No such file or directory\n`);
          code = 1;
          continue;
        }
      }
      if (many) process.stdout.write(`==> ${file ?? "stdin"} <==\n`);
      const lines = linesOf(text);
      const output = lines.slice(Math.max(0, lines.length - n)).join("\n");
      if (output) process.stdout.write(`${output}\n`);
    }
    return code;
  },
};
