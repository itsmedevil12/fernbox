// `minimal`: the floor. No commands, no shell, no userland at all — everything
// here is what the runtime itself provides, which is the point of the image: a
// bare isolate with the API surface available.
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

// The one file the image ships.
check("/etc/hosts", fs.readFileSync("/etc/hosts", "utf8"), "127.0.0.1 localhost\n");

// No command directory exists, so a command an app might reach for is simply
// absent — status 127, the shell's "command not found".
check("no /bin", fs.existsSync("/bin"), false);
check("no /usr/bin", fs.existsSync("/usr/bin"), false);
check("no /usr/local/bin", fs.existsSync("/usr/local/bin"), false);
check("no shell", run('sh -c "echo hi"').status, 127);

// What is here is the runtime, not an image: the Node-shaped surface an app
// programs against, with no userland behind it.
check("fs", typeof fs.readFileSync, "function");
check("cwd", process.cwd(), "/");

const summary = JSON.stringify({ image: "minimal", checks: passed + failures.length, passed, failures });
if (failures.length) process.stderr.write(`${failures.length} check(s) failed\n`);
summary;
