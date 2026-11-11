// `head`. The first N lines of each file, ten by default, and stdin when no file
// is given. `-n 3`, `--lines=3` and a bare `-3` all spell the count, the way the
// real one accepts all three.
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

// A trailing newline is not a line of its own, so it is trimmed before the split
// and put back per output, which keeps an empty input quiet.
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
          process.stderr.write(`head: cannot open '${file}' for reading: No such file or directory\n`);
          code = 1;
          continue;
        }
      }
      if (many) process.stdout.write(`==> ${file ?? "stdin"} <==\n`);
      const output = linesOf(text).slice(0, n).join("\n");
      if (output) process.stdout.write(`${output}\n`);
    }
    return code;
  },
};
