// `touch`. The virtual filesystem carries no timestamps, so there is no mtime to
// update: an existing file is left exactly as it is, and a missing one is made
// empty. `-c` keeps even that from happening, which is the whole of the flag.
const fs = require("fs");

module.exports = {
  main(args) {
    const create = !args.some((arg) => ["-c", "--no-create"].includes(arg));
    const targets = args.filter((arg) => !arg.startsWith("-"));
    if (targets.length === 0) {
      process.stderr.write("touch: missing file operand\n");
      return 1;
    }
    let code = 0;
    for (const file of targets) {
      if (fs.existsSync(file)) continue;
      if (!create) continue;
      try {
        fs.writeFileSync(file, "");
      } catch (err) {
        process.stderr.write(`touch: cannot touch '${file}': ${err.code ?? "EIO"}\n`);
        code = 1;
      }
    }
    return code;
  },
};
