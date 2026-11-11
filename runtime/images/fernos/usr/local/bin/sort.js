// `sort`. Lines in order: lexically by default, numerically with `-n`, reversed
// with `-r`, and `-u` keeps the first of each repeated line. stdin when no file
// is given, so a pipeline can order what the stage before it produced.
const fs = require("fs");

module.exports = {
  main(args) {
    const numeric = args.some((arg) => arg === "-n" || arg === "--numeric-sort");
    const reverse = args.some((arg) => arg === "-r" || arg === "--reverse");
    const unique = args.some((arg) => arg === "-u" || arg === "--unique");
    const files = args.filter((arg) => !arg.startsWith("-"));

    let text = "";
    let code = 0;
    if (files.length === 0) {
      text = process.stdin.read() ?? "";
    } else {
      for (const file of files) {
        try {
          text += fs.readFileSync(file, "utf8");
        } catch {
          process.stderr.write(`sort: cannot read: ${file}: No such file or directory\n`);
          code = 1;
        }
      }
    }

    // A trailing newline is not a line, and an empty input sorts to nothing
    // rather than to one empty line.
    const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
    if (text === "") {
      return code;
    }

    // Numeric sort on a line that is not a number falls back to 0, which is what
    // a reader of `sort -n` on mixed input expects rather than a NaN that would
    // scatter the entries.
    const key = numeric ? (line) => Number(line.trim().match(/-?\d+(\.\d+)?/)?.[0] ?? 0) : null;
    let sorted = key ? lines.sort((a, b) => key(a) - key(b)) : lines.sort();
    if (reverse) sorted = sorted.reverse();
    if (unique) {
      const seen = new Set();
      sorted = sorted.filter((line) => !seen.has(line) && seen.add(line));
    }
    process.stdout.write(`${sorted.join("\n")}\n`);
    return code;
  },
};
