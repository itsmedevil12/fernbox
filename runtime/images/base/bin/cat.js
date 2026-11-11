// `cat`. Files in order, one stream, so a concat is what you get. With no files
// it reads stdin, which is what makes a pipeline end somewhere useful. A
// missing file is reported by name and fails the run without swallowing the
// files that followed — the shell would do the same.
const fs = require("fs");

module.exports = {
  main(args) {
    let code = 0;
    if (args.length === 0) {
      const input = process.stdin.read();
      if (input) process.stdout.write(input);
      return code;
    }
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
};
