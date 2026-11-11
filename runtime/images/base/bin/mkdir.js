// `mkdir`. `-p` creates parents and stays quiet about a directory that already
// exists; without it, a missing parent is an error that names the path.
const fs = require("fs");

module.exports = {
  main(args) {
    const recursive = args.includes("-p") || args.includes("--parents");
    const dirs = args.filter((arg) => !arg.startsWith("-"));
    if (dirs.length === 0) {
      process.stderr.write("mkdir: missing operand\n");
      return 1;
    }
    let code = 0;
    for (const dir of dirs) {
      try {
        fs.mkdirSync(dir, { recursive });
      } catch (err) {
        // `-p` means "be there", and a directory that is already there is that.
        if (recursive && err.code === "EEXIST") continue;
        process.stderr.write(`mkdir: cannot create directory '${dir}': ${err.code}\n`);
        code = 1;
      }
    }
    return code;
  },
};
