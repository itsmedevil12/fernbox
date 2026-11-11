// `npm install` inside the sandbox: the registry is a host like any other, so
// the app maps it in its own /etc/hosts first — DNS is virtual by design. The
// tarball crosses the boundary as base64, inflates here, and lands under
// /node_modules where an ordinary `require` finds it.
const fs = require("fs");
const { execSync } = require("child_process");

fs.writeFileSync(
  "/etc/hosts",
  "127.0.0.1 localhost\n104.16.6.34 registry.npmjs.org\n",
);

// npm is a command, so it is run: a line of shell rather than a required
// module. Its stdout is returned on success; its stderr arrives on the thrown
// error's `stderr` when it fails, and nowhere on a success — the same contract
// `execSync` has under Node.
let stdout = "";
let stderr = "";
try {
  stdout = execSync("npm install left-pad@1.3.0");
} catch (err) {
  stderr = err.stderr;
}
const installed = fs.existsSync("/node_modules/left-pad");

// The point of the exercise: the tarball round-tripped into /node_modules well
// enough that an ordinary `require` loads it and it works.
const leftPad = installed ? require("left-pad") : null;
const padded = leftPad ? leftPad("x", 5) : null;

JSON.stringify({
  stdout: stdout.trim(),
  stderr: stderr.trim(),
  installed,
  files: installed ? fs.readdirSync("/node_modules/left-pad").sort() : [],
  padded,
});
