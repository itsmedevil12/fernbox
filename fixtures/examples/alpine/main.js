// `alpine`: the Alpine personality — a BusyBox-shaped userland of one
// multi-call binary behind applet shims, built on `minimal` so it inherits no
// other userland. Every applet runs once here, and the BusyBox conventions that
// make it a personality rather than a pile of commands are checked after them.
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

const s = "/tmp/alpine";
run(`rm -r -f ${s}`);
run(`mkdir -p ${s}`);

// `busybox` itself: the applet list with no argument, an applet by name, and a
// name it does not know.
const list = run("busybox").stdout;
check("busybox lists applets", list.includes("Applets:") && list.includes("echo"), true);
check("busybox applet", run("busybox echo from busybox").stdout, "from busybox\n");
check("busybox unknown applet", run("busybox nope").status, 127);

// The applets are the smaller versions, the way BusyBox's are: the common flags
// each one accepts, and no more.
check("echo", run("echo hello").stdout, "hello\n");
check("echo -n", run("echo -n hello").stdout, "hello");

fs.writeFileSync(`${s}/one`, "first\n");
check("cat", run(`cat ${s}/one`).stdout, "first\n");
check("cat stdin", run("cat", { input: "piped\n" }).stdout, "piped\n");

check("pwd", run("pwd").stdout, `${process.cwd()}\n`);
check("true", run("true").status, 0);
check("false", run("false").status, 1);

run(`mkdir -p ${s}/dir`);
fs.writeFileSync(`${s}/dir/a`, "");
fs.writeFileSync(`${s}/dir/.h`, "");
check("ls", run(`ls ${s}/dir`).stdout, "a\n");
check("ls -a", run(`ls -a ${s}/dir`).stdout, ".h\na\n");
const shape = (out) => ({ lines: out.trim().split("\n").length, kinds: out.trim().split("\n").map((line) => line[0]) });
check("ls -l", shape(run(`ls -l ${s}/dir`).stdout), { lines: 1, kinds: ["-"] });
check("ls -al", shape(run(`ls -al ${s}/dir`).stdout), { lines: 2, kinds: ["-", "-"] });
check("ls missing", run(`ls ${s}/nope`).status, 1);

check("mkdir -p", run(`mkdir -p ${s}/nested/deep`).status, 0);
check("rmdir", run(`rmdir ${s}/nested/deep`).status, 0);
check("rmdir non-empty", run(`rmdir ${s}/dir`).status, 1);

fs.writeFileSync(`${s}/movable`, "m\n");
check("mv", run(`mv ${s}/movable ${s}/dir`).status, 0);
check("mv moved", fs.existsSync(`${s}/dir/movable`), true);

run(`mkdir -p ${s}/tree/branch`);
fs.writeFileSync(`${s}/tree/branch/leaf`, "l\n");
check("cp -r", run(`cp -r ${s}/tree ${s}/tree2`).status, 0);
check("cp -r copied tree", fs.readFileSync(`${s}/tree2/branch/leaf`, "utf8"), "l\n");
check("cp --recursive", run(`cp --recursive ${s}/tree ${s}/tree3`).status, 0);
check("cp --recursive copied tree", fs.readFileSync(`${s}/tree3/branch/leaf`, "utf8"), "l\n");
check("rm -r", run(`rm -r ${s}/tree`).status, 0);
check("rm -r gone", fs.existsSync(`${s}/tree`), false);

// Bundled short flags: `-rf` is one word that means both, and the order inside
// the bundle does not matter. A tool that matched the whole word would lose them
// both and answer as though neither were given.
run(`mkdir -p ${s}/bundle`);
fs.writeFileSync(`${s}/bundle/keep`, "");
check("rm -rf bundle", run(`rm -rf ${s}/bundle`).status, 0);
check("rm -rf removed", fs.existsSync(`${s}/bundle`), false);
run(`mkdir -p ${s}/bundle2`);
fs.writeFileSync(`${s}/bundle2/keep`, "");
check("rm -fr bundle", run(`rm -fr ${s}/bundle2`).status, 0);
check("rm -fr removed", fs.existsSync(`${s}/bundle2`), false);

fs.writeFileSync(`${s}/nums`, "1\n2\n3\n4\n5\n");
check("head -n", run(`head -n 2 ${s}/nums`).stdout, "1\n2\n");
check("tail -n", run(`tail -n 2 ${s}/nums`).stdout, "4\n5\n");

fs.writeFileSync(`${s}/unsorted`, "3\n1\n2\n2\n");
check("sort", run(`sort ${s}/unsorted`).stdout, "1\n2\n2\n3\n");
check("sort -u", run(`sort -u ${s}/unsorted`).stdout, "1\n2\n3\n");
check("sort -r", run(`sort -r ${s}/unsorted`).stdout, "3\n2\n2\n1\n");
check("sort -ru", run(`sort -ru ${s}/unsorted`).stdout, "3\n2\n1\n");
check("sort --unique", run(`sort --unique ${s}/unsorted`).stdout, "1\n2\n3\n");

fs.writeFileSync(`${s}/words`, "a b c\nd\n");
check("wc -l", run(`wc -l ${s}/words`).stdout, `      2 ${s}/words\n`);
check("wc -w", run(`wc -w ${s}/words`).stdout, `      4 ${s}/words\n`);
check("wc -c", run(`wc -c ${s}/words`).stdout, `      8 ${s}/words\n`);
check("wc -lw", run(`wc -lw ${s}/words`).stdout, `      2       4 ${s}/words\n`);
check("wc --lines", run(`wc --lines ${s}/words`).stdout, `      2 ${s}/words\n`);

fs.writeFileSync(`${s}/fruit`, "apple\nBanana\ncherry\n");
check("grep -c", run(`grep -c an ${s}/fruit`).stdout, "1\n");
check("grep -i", run(`grep -i AN ${s}/fruit`).stdout, "Banana\n");
check("grep -v", run(`grep -v a ${s}/fruit`).stdout, "cherry\n");
check("grep no match", run(`grep zzz ${s}/fruit`).status, 1);
check("grep -in", run(`grep -in an ${s}/fruit`).stdout, "2:Banana\n");
check("grep --count", run(`grep --count an ${s}/fruit`).stdout, "1\n");

check("touch", run(`touch ${s}/touched`).status, 0);
check("touch created empty", fs.readFileSync(`${s}/touched`, "utf8"), "");
run(`touch -c ${s}/never`);
check("touch -c does not create", fs.existsSync(`${s}/never`), false);

check("printenv name", run("printenv EXAMPLE", { env: { EXAMPLE: "set" } }).stdout, "set\n");
check("printenv unset", run("printenv NO_SUCH_VAR").status, 1);

check("sh -c", run('sh -c "echo from sh"').stdout, "from sh\n");

// What makes this image Alpine rather than base: no /usr/local/bin at all, the
// applets living where a shim can require them, and a shim being a command.
check("no /usr/local/bin", fs.existsSync("/usr/local/bin"), false);
check("applets are a module", typeof require("/usr/lib/busybox/applets.js").echo, "function");
check("no inherited /bin commands", run("ls /usr/lib/busybox").stdout.includes("applets.js"), true);
let refused = null;
try {
  require("/bin/cat.js");
} catch (err) {
  refused = err.code;
}
check("require refuses an applet shim", refused, "ERR_REQUIRE_COMMAND");

const summary = JSON.stringify({ image: "alpine", checks: passed + failures.length, passed, failures });
if (failures.length) process.stderr.write(`${failures.length} check(s) failed\n`);
summary;
