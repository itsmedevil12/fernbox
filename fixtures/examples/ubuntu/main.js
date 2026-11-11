// `ubuntu`: the Ubuntu personality — `base` underneath, with Ubuntu's identity
// files in `/etc` and nothing else. There are no commands of its own, so what
// this example checks is the identity it declares and the userland it inherits.
//
// A failed check is recorded, not thrown: the point is to see every answer in
// one report, and an exception would cut it off at the first one.
const { execSync } = require("child_process");
const fs = require("fs");

let passed = 0;
const failures = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else failures.push({ name, expected, actual });
  process.stdout.write(`${ok ? "ok   " : "FAIL "} ${name}: ${JSON.stringify(actual)}\n`);
};

// A command's failure arrives as a thrown error carrying its status, so the
// example wraps the call and keeps the pieces — a non-zero status is a result to
// be checked, not an exception to survive.
const run = (line, options) => {
  try {
    return { status: 0, stdout: execSync(line, options), stderr: "" };
  } catch (err) {
    return { status: err.status, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
};

// The identity. `/etc/os-release` is the one path an app asks which image it is
// on, so a personality that layers over `base` must replace it rather than add
// its own.
const osRelease = fs.readFileSync("/etc/os-release", "utf8");
check("os-release name", osRelease.includes("Ubuntu 24.04.1 LTS"), true);
check("os-release id", osRelease.includes("ID=ubuntu"), true);
check("lsb-release", fs.readFileSync("/etc/lsb-release", "utf8").includes("DISTRIB_ID=Ubuntu"), true);
check("debian_version", fs.readFileSync("/etc/debian_version", "utf8"), "trixie/sid\n");
check("hostname", fs.readFileSync("/etc/hostname", "utf8"), "ubuntu\n");

// `sources.list` states which distribution this is. Nothing reads it: there is
// no `apt`, and no package manager anywhere in the sandbox.
check("sources.list", fs.readFileSync("/etc/apt/sources.list", "utf8").includes("archive.ubuntu.com"), true);
check("apt is not there", run("apt list").status, 127);

// The inherited userland: `base`'s `/bin` answers, and a command an image does
// not ship is a status rather than a crash.
check("inherited shell", run('sh -c "echo ok"').stdout, "ok\n");
check("inherited /bin", run("ls /bin").stdout.includes("sh.js"), true);
check("inherited command", run("cat /etc/os-release").stdout, osRelease);

// Ubuntu merges `/bin` into `/usr/bin`. This filesystem has no symlinks, so the
// inherited `/bin` simply is that one directory — there is no second copy.
check("no separate /usr/bin", fs.existsSync("/usr/bin"), false);

const summary = JSON.stringify({ image: "ubuntu", checks: passed + failures.length, passed, failures });
if (failures.length) process.stderr.write(`${failures.length} check(s) failed\n`);
summary;
