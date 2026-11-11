// One app, four personalities. The caller picks the image with `--image`; an
// app cannot choose its own. What changes between them is which directories
// hold commands and which userland backs them — the app's code is identical,
// which is the point: a personality is a filesystem, not an API.
const fs = require("fs");
const { execSync } = require("child_process");

// `/etc/os-release` is where every image declares itself, so it is the one path
// an app can ask "which image am I on" and always get an answer.
const release = Object.fromEntries(
  fs
    .readFileSync("/etc/os-release", "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
    }),
);

// The layout itself: which command directories exist, and what each one holds.
// Base keeps its commands in /bin, fernos adds /usr/local/bin, alpine ships /bin
// with no inherited /usr at all, and ubuntu is base underneath its /etc.
const layout = ["/usr/local/bin", "/usr/bin", "/bin"]
  .filter((dir) => fs.existsSync(dir))
  .map((dir) => ({
    dir,
    commands: fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".js"))
      .map((name) => name.replace(/\.js$/, ""))
      .sort(),
  }));

fs.writeFileSync("/tmp/nums.txt", "3\n1\n2\n");

// A command an image does not ship is a status, not a crash: the app reports it
// and carries on, the way a script on a real machine would.
const tryRun = (line) => {
  try {
    return execSync(line).trim();
  } catch (err) {
    return `status ${err.status}`;
  }
};

JSON.stringify(
  {
    name: release.NAME,
    variant: release.VARIANT_ID ?? release.ID,
    pretty: release.PRETTY_NAME,
    hostname: fs.readFileSync("/etc/hostname", "utf8").trim(),
    layout,
    sorted: tryRun("sort /tmp/nums.txt"),
    head: tryRun("head -n 1 /etc/os-release"),
    grep: tryRun("grep -c 2 /tmp/nums.txt"),
    busybox: tryRun("busybox echo from busybox"),
    apt: tryRun("apt list"),
  },
  null,
  1,
);
