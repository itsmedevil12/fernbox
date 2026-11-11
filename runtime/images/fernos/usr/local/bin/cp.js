// `cp`. One file is a read and a write; `-r` walks a tree and makes the
// destination tree as it goes. Onto a directory means into it, keeping the
// source's name, and several sources insist on a directory destination the way
// the real one does.
const fs = require("fs");
const path = require("path");

// A child of the tree is as likely to be a file as a directory, so the recursion
// asks rather than assuming — a directory gets made and walked, a file gets
// written.
const copyTree = (source, dest) => {
  if (!fs.statSync(source).isDirectory()) {
    fs.writeFileSync(dest, fs.readFileSync(source, "utf8"));
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(source)) {
    copyTree(path.join(source, name), path.join(dest, name));
  }
};

module.exports = {
  main(args) {
    const recursive = args.some((arg) => ["-r", "-R", "--recursive"].includes(arg));
    const targets = args.filter((arg) => !arg.startsWith("-"));
    if (targets.length < 2) {
      process.stderr.write("cp: missing destination file operand\n");
      return 1;
    }
    const dest = targets[targets.length - 1];
    const sources = targets.slice(0, -1);

    let into = false;
    try {
      into = fs.statSync(dest).isDirectory();
    } catch {
      /* a destination that does not exist yet is one a file can become */
    }
    if (sources.length > 1 && !into) {
      process.stderr.write(`cp: target '${dest}' is not a directory\n`);
      return 1;
    }

    let code = 0;
    for (const source of sources) {
      const target = into ? path.join(dest, path.basename(source)) : dest;
      try {
        if (fs.statSync(source).isDirectory()) {
          if (!recursive) {
            const err = new Error(`cannot copy '${source}': Is a directory`);
            err.code = "EISDIR";
            throw err;
          }
          copyTree(source, target);
        } else {
          fs.writeFileSync(target, fs.readFileSync(source, "utf8"));
        }
      } catch (err) {
        process.stderr.write(`cp: cannot copy '${source}' to '${dest}': ${err.code ?? "EIO"}\n`);
        code = 1;
      }
    }
    return code;
  },
};
