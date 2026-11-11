// `grep`. Lines matching a pattern, and the pattern is a regular expression
// because that is what a grep pattern is: `-c` counts them, `-n` numbers them,
// `-v` keeps the lines that do not match, `-i` ignores case. Status 1 means
// "no line matched", the way grep reports it, and 2 means a pattern it could not
// compile or a file it could not read.
const fs = require("fs");

module.exports = {
  main(args) {
    const ignoreCase = args.some((arg) => arg === "-i" || arg === "--ignore-case");
    const invert = args.some((arg) => arg === "-v" || arg === "--invert-match");
    const number = args.some((arg) => arg === "-n" || arg === "--line-number");
    const countOnly = args.some((arg) => arg === "-c" || arg === "--count");
    const positional = args.filter((arg) => !arg.startsWith("-"));

    if (positional.length === 0) {
      process.stderr.write("grep: a pattern is required\n");
      return 2;
    }
    const pattern = positional[0];
    const files = positional.slice(1);

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
      if (file === null) {
        text = process.stdin.read() ?? "";
      } else {
        try {
          text = fs.readFileSync(file, "utf8");
        } catch {
          process.stderr.write(`grep: ${file}: No such file or directory\n`);
          code = 2;
          continue;
        }
      }
      const lines = text === "" ? [] : text.split("\n");
      if (lines.length && text.endsWith("\n")) lines.pop();

      let hits = 0;
      lines.forEach((line, i) => {
        if (re.test(line) === invert) return;
        hits++;
        if (countOnly) return;
        const tag = many ? `${file === null ? "stdin" : file}:` : "";
        process.stdout.write(`${tag}${number ? `${i + 1}:` : ""}${line}\n`);
      });
      if (countOnly) process.stdout.write(`${hits}\n`);
      if (hits === 0) code = 1;
    }
    return code;
  },
};
