// `mv`. One rename, so the source is gone the moment the destination exists —
// no copy-then-delete, and no partial state a crash could leave behind.
const fs = require("fs");
const path = require("path");

module.exports = {
  main(args) {
    const targets = args.filter((arg) => !arg.startsWith("-"));
    if (targets.length < 2) {
      process.stderr.write("mv: missing destination file operand\n");
      return 1;
    }
    const source = targets[0];
    const dest = targets[1];
    try {
      // Onto a directory means into it, keeping the source's name.
      const into = fs.statSync(dest);
      if (into.isDirectory()) {
        fs.renameSync(source, path.join(dest, path.basename(source)));
        return 0;
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        process.stderr.write(`mv: ${err.message}\n`);
        return 1;
      }
    }
    try {
      fs.renameSync(source, dest);
    } catch (err) {
      process.stderr.write(`mv: cannot move '${source}' to '${dest}': ${err.code}\n`);
      return 1;
    }
    return 0;
  },
};
