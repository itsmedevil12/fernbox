// `tee`. stdin to stdout and to every file named, which is how a pipeline keeps
// a copy of what flowed through it. `-a` appends instead of replacing. Writes
// that fail are reported by name and fail the command, but the stream is not
// stopped — a pipe behind this one still gets everything that came in.
const fs = require("fs");

module.exports = {
  main(args) {
    const append = args.some((arg) => arg === "-a" || arg === "--append");
    const files = args.filter((arg) => !arg.startsWith("-"));

    const input = process.stdin.read() ?? "";
    process.stdout.write(input);
    let code = 0;
    for (const file of files) {
      try {
        if (append) fs.appendFileSync(file, input);
        else fs.writeFileSync(file, input);
      } catch (err) {
        process.stderr.write(`tee: ${file}: ${err.code ?? "EIO"}\n`);
        code = 1;
      }
    }
    return code;
  },
};
