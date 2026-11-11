// `wc`. Lines, words and characters of each file, and stdin when no file is
// given. A line is a newline, so a text without a trailing one counts as zero
// lines the way the real one counts it; the character count is utf8 units,
// which is what the filesystem holds.
const fs = require("fs");

const count = (text) => {
  const lines = text === "" ? 0 : text.split("\n").length - 1;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  return { lines, words, chars: text.length };
};

module.exports = {
  main(args) {
    const want = (flag, full) => args.some((arg) => arg === flag || arg === full);
    const lines = want("-l", "--lines");
    const words = want("-w", "--words");
    const chars = want("-c", "--bytes");
    const all = !lines && !words && !chars;
    const files = args.filter((arg) => !arg.startsWith("-"));

    const report = (name, c, many) => {
      const parts = [];
      if (all || lines) parts.push(String(c.lines).padStart(7));
      if (all || words) parts.push(String(c.words).padStart(7));
      if (all || chars) parts.push(String(c.chars).padStart(7));
      process.stdout.write(`${parts.join(" ")}${many || name ? ` ${name}` : ""}\n`);
    };

    if (files.length === 0) {
      report("", count(process.stdin.read() ?? ""), false);
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
      report(file, c, files.length > 1);
    }
    if (files.length > 1) report("total", total, true);
    return code;
  },
};
