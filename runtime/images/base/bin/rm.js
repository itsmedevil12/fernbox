// `rm`. `-r` walks a tree, `-f` stays quiet about a path that was never there.
// A directory without `-r` is refused, because removing it is not what the
// caller asked for.
const fs = require("fs");
const path = require("path");

const remove = (target, recursive) => {
  const st = fs.statSync(target);
  if (st.isFile()) {
    fs.unlinkSync(target);
    return;
  }
  if (!recursive) {
    const err = new Error(`cannot remove '${target}': Is a directory`);
    err.code = "EISDIR";
    throw err;
  }
  for (const name of fs.readdirSync(target)) {
    remove(path.join(target, name), recursive);
  }
  fs.rmdirSync(target);
};

module.exports = {
  main(args) {
    const recursive = args.some((arg) => ["-r", "-R", "--recursive"].includes(arg));
    const force = args.some((arg) => ["-f", "--force"].includes(arg));
    const targets = args.filter((arg) => !arg.startsWith("-"));
    let code = 0;
    for (const target of targets) {
      try {
        remove(target, recursive);
      } catch (err) {
        if (force && err.code === "ENOENT") continue;
        process.stderr.write(`rm: ${err.message}\n`);
        code = 1;
      }
    }
    return code;
  },
};
