// `rmdir`. Directories only, and only when empty — the two constraints that
// make it safe to reach for when `rm -r` would be too much.
const fs = require("fs");

module.exports = {
  main(args) {
    const dirs = args.filter((arg) => !arg.startsWith("-"));
    let code = 0;
    for (const dir of dirs) {
      try {
        fs.rmdirSync(dir);
      } catch (err) {
        process.stderr.write(`rmdir: failed to remove '${dir}': ${err.code}\n`);
        code = 1;
      }
    }
    return code;
  },
};
