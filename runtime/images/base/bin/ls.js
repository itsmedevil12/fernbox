// `ls`, lite. `-a` stops dot-prefixed names being hidden, `-l` prints one entry
// per line with its type and size. The flags combine the way they do in the
// real one, so `ls -al` is not a surprise.
//
// Deliberately missing: `.` and `..`. The virtual filesystem has no parent
// links to list, and inventing them would report state that is not there.
const fs = require("fs");
const path = require("path");

const entry = (dir, name, long) => {
  if (!long) return name;
  const st = fs.statSync(path.join(dir, name));
  return `${st.isDirectory() ? "d" : "-"} ${String(st.size).padStart(8)} ${name}`;
};

const listOne = (target, long, showAll) => {
  let st;
  try {
    st = fs.statSync(target);
  } catch {
    process.stderr.write(`ls: cannot access '${target}': No such file or directory\n`);
    return 1;
  }
  if (st.isFile()) {
    process.stdout.write(`${long ? `- ${String(st.size).padStart(8)} ` : ""}${path.basename(target)}\n`);
    return 0;
  }
  const names = fs
    .readdirSync(target)
    .filter((name) => showAll || !name.startsWith("."))
    .sort();
  const lines = names.map((name) => entry(target, name, long));
  if (lines.length) process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
};

module.exports = {
  main(args) {
    const flags = new Set();
    const targets = [];
    for (const arg of args) {
      if (arg.startsWith("-") && arg.length > 1) {
        for (const ch of arg.slice(1)) flags.add(ch);
      } else {
        targets.push(arg);
      }
    }
    const long = flags.has("l");
    const showAll = flags.has("a");
    if (targets.length === 0) targets.push(process.cwd());

    let code = 0;
    const many = targets.length > 1;
    for (const target of targets) {
      if (many) process.stdout.write(`${target}:\n`);
      code = listOne(target, long, showAll) || code;
    }
    return code;
  },
};
