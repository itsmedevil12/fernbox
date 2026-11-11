// `uname`. The machine's name, the way a startup script asks for it. There is no
// host kernel behind the sandbox to report, so the kernel name and the release
// are the image's own — `-r` answers the FernBox version, not Linux's, and `-m`
// is deliberately absent rather than naming a processor the isolate never sees.
// The nodename is the image's hostname, which is the one thing here that is.
const fs = require("fs");

const KERNEL = "FernBox";
const RELEASE = "0.1";

const nodename = () => {
  try {
    return fs.readFileSync("/etc/hostname", "utf8").trim() || "fernbox";
  } catch {
    return "fernbox";
  }
};

module.exports = {
  main(args) {
    const parts = [];
    const all = args.some((arg) => arg === "-a" || arg === "--all");
    const ask = (flag) => all || args.includes(flag);
    if (ask("-s") || (!args.length && !all)) parts.push(KERNEL);
    if (ask("-n")) parts.push(nodename());
    if (ask("-r")) parts.push(RELEASE);
    if (parts.length === 0) {
      process.stderr.write(`uname: unknown flag: ${args.join(" ")}\n`);
      return 1;
    }
    process.stdout.write(`${parts.join(" ")}\n`);
    return 0;
  },
};
