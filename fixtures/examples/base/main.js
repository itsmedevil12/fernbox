// `base`: the common floor every other image stands on. Each example runs every
// command the image ships once, the way a script on a real machine would reach
// for it, and records what answered.
//
// A failed check is recorded, not thrown: the point is to see every command's
// answer in one report, and an exception would cut it off at the first one.
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

const s = "/tmp/base";
run(`rm -r -f ${s}`);
run(`mkdir -p ${s}`);

// `echo`. The whole command is joining arguments, and `-n` is the one flag.
check("echo", run("echo hello").stdout, "hello\n");
check("echo -n", run("echo -n hello").stdout, "hello");

// `cat`. Files in order, and stdin when none are given — which is what makes a
// pipeline end somewhere useful.
fs.writeFileSync(`${s}/one.txt`, "first\n");
check("cat", run(`cat ${s}/one.txt`).stdout, "first\n");
check("cat stdin", run("cat", { input: "piped in\n" }).stdout, "piped in\n");
check("cat missing", run(`cat ${s}/nope`).status, 1);

// `ls`. Dot-prefixed names are hidden until `-a`, and `-l` gives type and size —
// the flags combine, so `-al` is not a surprise.
run(`mkdir -p ${s}/dir`);
fs.writeFileSync(`${s}/dir/a`, "");
fs.writeFileSync(`${s}/dir/.hidden`, "");
check("ls", run(`ls ${s}/dir`).stdout, "a\n");
check("ls -a", run(`ls -a ${s}/dir`).stdout, ".hidden\na\n");
const shape = (out) => ({ lines: out.trim().split("\n").length, kinds: out.trim().split("\n").map((line) => line[0]) });
check("ls -l", shape(run(`ls -l ${s}/dir`).stdout), { lines: 1, kinds: ["-"] });
check("ls -al", shape(run(`ls -al ${s}/dir`).stdout), { lines: 2, kinds: ["-", "-"] });
check("ls missing", run(`ls ${s}/nope`).status, 1);

// `mkdir`. `-p` creates parents and stays quiet about a directory that exists.
check("mkdir -p", run(`mkdir -p ${s}/nested/deep`).status, 0);
check("mkdir existing", run(`mkdir ${s}/nested`).status, 1);
check("mkdir -p existing", run(`mkdir -p ${s}/nested`).status, 0);

// `mv`. One rename, so the source is gone the moment the destination exists.
fs.writeFileSync(`${s}/movable`, "m\n");
check("mv into dir", run(`mv ${s}/movable ${s}/dir`).status, 0);
check("mv moved", fs.existsSync(`${s}/dir/movable`), true);
check("mv rename", run(`mv ${s}/dir/movable ${s}/dir/renamed`).status, 0);
check("mv renamed", fs.existsSync(`${s}/dir/renamed`), true);

// `pwd`. The one working directory, moved by a shell `cd`.
check("pwd", run("pwd").stdout, `${process.cwd()}\n`);
check("pwd after cd", run('sh -c "cd /etc && pwd"').stdout, "/etc\n");

// `rm`. `-r` walks a tree, `-f` stays quiet about a path that was never there,
// and a directory without `-r` is refused rather than emptied.
fs.writeFileSync(`${s}/gone`, "");
check("rm", run(`rm ${s}/gone`).status, 0);
check("rm file gone", fs.existsSync(`${s}/gone`), false);
check("rm dir without -r", run(`rm ${s}/dir`).status, 1);
check("rm -r", run(`rm -r ${s}/dir`).status, 0);
check("rm -r gone", fs.existsSync(`${s}/dir`), false);
check("rm -f missing", run(`rm -f ${s}/never`).status, 0);

// `rmdir`. Directories only, and only when empty.
run(`mkdir -p ${s}/empty ${s}/full`);
fs.writeFileSync(`${s}/full/inside`, "");
check("rmdir", run(`rmdir ${s}/empty`).status, 0);
check("rmdir non-empty", run(`rmdir ${s}/full`).status, 1);

// `printenv`. The caller's env is the whole of `process.env` inside; an unset
// name costs the exit code rather than an empty line.
check("printenv name", run("printenv EXAMPLE", { env: { EXAMPLE: "set" } }).stdout, "set\n");
check("printenv unset", run("printenv NO_SUCH_VAR").status, 1);

// `sh`. `-c` for one line, bare arguments joined into one, and a prompt loop
// over stdin that ends on EOF or `exit`.
check("sh -c", run('sh -c "echo a; echo b"').stdout, "a\nb\n");
check("sh args", run("sh echo joined args").stdout, "joined args\n");
check("sh prompt", run("sh", { input: "echo from the prompt\n" }).stdout, "from the prompt\n");
check("sh exit", run("sh", { input: "exit 3\n" }).status, 3);

// `node`. Virtual processes are not built yet, so the shim answers with a named
// failure rather than an empty success.
const node = run("node -e 1");
check("node not implemented", { status: node.status, says: node.stderr.includes("not implemented") }, { status: 127, says: true });

// `npm`. The registry is a host like any other and DNS is virtual, so the app
// maps it in its own /etc/hosts before the first install. This check reaches
// the real registry and needs the network to be there.
fs.writeFileSync("/etc/hosts", "127.0.0.1 localhost\n104.16.6.34 registry.npmjs.org\n");
const npm = run("npm install left-pad@1.3.0");
check("npm install", { status: npm.status, installed: fs.existsSync("/node_modules/left-pad") }, { status: 0, installed: true });
const leftPad = fs.existsSync("/node_modules/left-pad") ? require("left-pad") : null;
check("npm package runs", leftPad ? leftPad("x", 5) : null, "    x");

// The interface rule: a command is run, not required.
let refused = null;
try {
  require("/bin/ls.js");
} catch (err) {
  refused = err.code;
}
check("require refuses a command", refused, "ERR_REQUIRE_COMMAND");

const summary = JSON.stringify({ image: "base", checks: passed + failures.length, passed, failures });
if (failures.length) process.stderr.write(`${failures.length} check(s) failed\n`);
summary;
