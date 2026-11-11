// The `/bin` shims are commands, so an app reaches them through
// `child_process` rather than `require`: a line of shell, a captured result, and
// a thrown error carrying the status when the command fails. Each returns an
// exit code and writes to the streams the shell swapped onto it.
const { execSync } = require("child_process");

// A directory that lists both layers: `/etc` is the base image, `/tmp/sub` is
// this run's own creation. A command's stdout is returned, not printed, so it
// reaches the caller when the app forwards it.
execSync("mkdir -p /tmp/sub/deep");
process.stdout.write(execSync("ls /etc"));
process.stdout.write(execSync("ls -l /tmp/sub"));
console.log(`mkdir made /tmp/sub/deep: ${require("fs").existsSync("/tmp/sub/deep")}`);

// A missing file is reported on stderr and costs the exit code, which arrives
// on the thrown error the way it does under Node.
let missing = null;
try {
  execSync("cat /etc/nope");
} catch (err) {
  missing = err.status;
}
console.log(`cat of a missing file exited ${missing}`);

// `-r` takes a tree with it.
execSync("mkdir -p /tmp/tree/branch");
execSync("rm -r /tmp/tree");
console.log(`rm -r left nothing: ${!require("fs").existsSync("/tmp/tree")}`);

"shims ok";
