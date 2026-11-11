// The simulated shell, end to end. An app runs commands out of `/bin` the way
// Node code runs them, and the results are what an author would expect from a
// real one — which is the point: the sandbox should read like ordinary Node.
const fs = require("fs");
const { execSync, execFileSync, exec } = require("child_process");

const checks = {};
const check = (name, fn) => {
  try {
    checks[name] = fn();
  } catch (err) {
    checks[name] = `threw: ${err.message}`;
  }
};

check("echo", () => execSync("echo hello"));
check("quoted args", () => execSync('echo "one   two"'));
check("semicolon", () => execSync("echo a; echo b"));
check("pipe", () => execSync("echo hello | cat"));
check("and-then short-circuits", () => {
  try {
    execSync("false && echo nope");
    return "did not throw";
  } catch (err) {
    return err.status;
  }
});
check("or-else runs", () => execSync("false || echo yes"));
check("redirect", () => {
  execSync("echo written > /tmp/shell-out.txt");
  return fs.readFileSync("/tmp/shell-out.txt", "utf8");
});
check("append redirect", () => {
  execSync("echo more >> /tmp/shell-out.txt");
  return fs.readFileSync("/tmp/shell-out.txt", "utf8");
});
check("stdin from input", () => execSync("cat", { input: "piped in\n" }));
check("sh -c", () => execSync("sh -c 'echo from sh'"));
check("sh with a cd", () => execSync("sh -c 'cd /etc && pwd'"));
check("cwd option", () => execSync("pwd", { cwd: "/etc" }));
check("unknown command status", () => {
  try {
    execSync("definitely-not-a-command");
    return "did not throw";
  } catch (err) {
    return err.status;
  }
});
check("failing command status", () => {
  try {
    execSync("cat /no-such-file");
    return "did not throw";
  } catch (err) {
    return { status: err.status, stderr: err.stderr };
  }
});
check("execFileSync keeps an operator as data", () => execFileSync("/bin/echo", ["a|b", "c;d"]));
check("exec async", () => {
  // The run's completion value is captured before the microtask queue drains —
  // an established property of this runtime, not a bug here — so the callback's
  // result reaches the run's *stdout* rather than this object. It is asserted
  // by the caller, not by this check.
  exec("echo async", (err, stdout) => {
    process.stdout.write(`async saw: ${err ? err.message : stdout}`);
  });
  return "scheduled";
});

// A command the app writes itself: proves a child's `console.log` lands in the
// capture rather than the parent's stdout, which is what the lazy console
// lookup is for.
fs.writeFileSync(
  "/tmp/hello.js",
  "module.exports = { main() { console.log('from child'); return 0; } };",
);
check("console.log inside a child", () => execSync("/tmp/hello.js"));

// A child that exits: the code is its status, and the parent's `exitCode` is
// untouched, because they share one process object.
fs.writeFileSync(
  "/tmp/exits.js",
  "module.exports = { main() { process.exit(3); return 0; } };",
);
check("child exit code", () => {
  const before = process.exitCode;
  let status = null;
  try {
    execSync("/tmp/exits.js");
  } catch (err) {
    status = err.status;
  }
  return { status, parentExitCode: process.exitCode, before };
});

JSON.stringify(checks, null, 1);
