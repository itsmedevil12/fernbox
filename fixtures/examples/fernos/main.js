// `fernos`: the FernBox personality — `base` underneath, plus the small toolbox a
// service needs in `/usr/local/bin`. Each of its own commands runs once here; the
// inherited ones are checked at the end, because an image is also what it stands
// on.
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

const s = "/tmp/fernos";
run(`rm -r -f ${s}`);
run(`mkdir -p ${s}`);

// `cp`. One file is a read and a write; onto a directory means into it; several
// sources insist on a directory destination; `-r` walks a tree.
fs.writeFileSync(`${s}/src`, "s\n");
check("cp file", run(`cp ${s}/src ${s}/dst`).status, 0);
check("cp copied", fs.readFileSync(`${s}/dst`, "utf8"), "s\n");
run(`mkdir -p ${s}/into`);
check("cp into dir", run(`cp ${s}/src ${s}/into`).status, 0);
check("cp into dir kept name", fs.existsSync(`${s}/into/src`), true);
fs.writeFileSync(`${s}/a`, "a\n");
fs.writeFileSync(`${s}/b`, "b\n");
check("cp several into dir", run(`cp ${s}/a ${s}/b ${s}/into`).status, 0);
check("cp several to a file", run(`cp ${s}/a ${s}/b ${s}/not-a-dir`).status, 1);
run(`mkdir -p ${s}/tree/branch`);
fs.writeFileSync(`${s}/tree/branch/leaf`, "l\n");
check("cp -r", run(`cp -r ${s}/tree ${s}/tree2`).status, 0);
check("cp -r copied tree", fs.readFileSync(`${s}/tree2/branch/leaf`, "utf8"), "l\n");

// `env`. Pairs before a command apply to that command alone, and the command is
// the shell's own runner, so a child of the child still sees them.
check("env dumps", run("env").status, 0);
check("env sets one", run("env FOO=bar printenv FOO").stdout, "bar\n");
check("env reaches a child", run('env FOO=bar sh -c "printenv FOO"').stdout, "bar\n");

// `grep`. The pattern is a regular expression; 1 means nothing matched and 2
// means the pattern would not compile or the file would not open.
fs.writeFileSync(`${s}/fruit`, "apple\nBanana\ncherry\napricot\n");
check("grep -c", run(`grep -c an ${s}/fruit`).stdout, "1\n");
check("grep -i", run(`grep -i AN ${s}/fruit`).stdout, "Banana\n");
check("grep -n", run(`grep -n ^a ${s}/fruit`).stdout, "1:apple\n4:apricot\n");
check("grep -v", run(`grep -v a ${s}/fruit`).stdout, "cherry\n");
check("grep no match", run(`grep zzz ${s}/fruit`).status, 1);
check("grep bad pattern", run(`grep ( ${s}/fruit`).status, 2);

// `head` and `tail`. Counts are spelled three ways — `-n 2`, `--lines=2`, `-2` —
// and stdin is the source when no file is given.
fs.writeFileSync(`${s}/nums`, "1\n2\n3\n4\n5\n");
check("head -n", run(`head -n 2 ${s}/nums`).stdout, "1\n2\n");
check("head --lines", run(`head --lines=2 ${s}/nums`).stdout, "1\n2\n");
check("head -N", run(`head -2 ${s}/nums`).stdout, "1\n2\n");
check("head stdin", run("head -n 1", { input: "a\nb\n" }).stdout, "a\n");
check("tail -n", run(`tail -n 2 ${s}/nums`).stdout, "4\n5\n");
check("tail --lines", run(`tail --lines=2 ${s}/nums`).stdout, "4\n5\n");
check("tail -N", run(`tail -2 ${s}/nums`).stdout, "4\n5\n");

// `sort`. Lexical by default, numeric with `-n` — which is the one that would
// surprise if it were missing, since "10" sorts before "9" lexically.
fs.writeFileSync(`${s}/unsorted`, "3\n1\n2\n2\n");
check("sort", run(`sort ${s}/unsorted`).stdout, "1\n2\n2\n3\n");
check("sort -u", run(`sort -u ${s}/unsorted`).stdout, "1\n2\n3\n");
check("sort -r", run(`sort -r ${s}/unsorted`).stdout, "3\n2\n2\n1\n");
fs.writeFileSync(`${s}/numbers`, "10\n9\n");
check("sort -n", run(`sort -n ${s}/numbers`).stdout, "9\n10\n");

// `tee`. A pipeline's copy, appended to with `-a`.
check("tee", run(`echo hi | tee ${s}/tee`).stdout, "hi\n");
check("tee wrote", fs.readFileSync(`${s}/tee`, "utf8"), "hi\n");
check("tee -a", run(`echo more | tee -a ${s}/tee`).stdout, "more\n");
check("tee appended", fs.readFileSync(`${s}/tee`, "utf8"), "hi\nmore\n");

// `touch`. The filesystem carries no timestamps, so an existing file is left
// exactly as it was and `-c` keeps even an empty one from being made.
check("touch creates", run(`touch ${s}/touched`).status, 0);
check("touch created empty", fs.readFileSync(`${s}/touched`, "utf8"), "");
fs.writeFileSync(`${s}/keep`, "kept\n");
run(`touch ${s}/keep`);
check("touch leaves contents", fs.readFileSync(`${s}/keep`, "utf8"), "kept\n");
run(`touch -c ${s}/never`);
check("touch -c does not create", fs.existsSync(`${s}/never`), false);

// `uname`. The kernel name and release are the image's own, and the nodename is
// its hostname — `-m` is absent rather than naming a processor it never sees.
check("uname", run("uname").stdout, "FernBox\n");
check("uname -s", run("uname -s").stdout, "FernBox\n");
check("uname -r", run("uname -r").stdout, "0.1\n");
check("uname -n", run("uname -n").stdout, `${fs.readFileSync("/etc/hostname", "utf8").trim()}\n`);

// `wc`. A line is a newline and a character is a utf8 unit; several files also
// get a total.
fs.writeFileSync(`${s}/words`, "a b c\nd\n");
check("wc -l", run(`wc -l ${s}/words`).stdout, `      2 ${s}/words\n`);
check("wc -w", run(`wc -w ${s}/words`).stdout, `      4 ${s}/words\n`);
check("wc -c", run(`wc -c ${s}/words`).stdout, `      8 ${s}/words\n`);
check("wc all", run(`wc ${s}/words`).stdout, `      2       4       8 ${s}/words\n`);
check("wc total", run(`wc -l ${s}/words ${s}/nums`).stdout, `      2 ${s}/words\n      5 ${s}/nums\n      7 total\n`);

// `whoami`. The sandbox has one identity and it is not the host user's.
check("whoami", run("whoami").stdout, "fernbox\n");

// The inheritance: `base` is underneath, so its `/bin` answers and the identity
// the image declares is the fernos one, not the base one it replaced.
check("inherited /bin answers", run("ls /bin").stdout.includes("sh.js"), true);
check("base command runs", run("cat /etc/os-release").stdout.includes("FernBox"), true);
check("fernos identity", fs.readFileSync("/etc/os-release", "utf8").includes("fernos"), true);
check("/usr/local/bin exists", fs.existsSync("/usr/local/bin"), true);

// The interface rule, at the directory this image fills.
let refused = null;
try {
  require("/usr/local/bin/grep.js");
} catch (err) {
  refused = err.code;
}
check("require refuses a command", refused, "ERR_REQUIRE_COMMAND");

const summary = JSON.stringify({ image: "fernos", checks: passed + failures.length, passed, failures });
if (failures.length) process.stderr.write(`${failures.length} check(s) failed\n`);
summary;
