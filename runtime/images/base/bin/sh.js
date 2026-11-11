// `sh`, the simulated shell. With `-c` it runs one command line, the way every
// caller spells it; with other arguments it joins them into a command line;
// with none it is a prompt loop, reading a line at a time from stdin until EOF
// or `exit`, the way a terminal does.
//
// It is a thin driver over the same runner `child_process.execSync` uses, so a
// command behaves identically however it was reached. The shell owns the
// directory across lines, because a `cd` in one line should move the next one.
const shell = require("shell");

module.exports = {
  main(args) {
    if (args.length === 0) return repl();

    const line = args[0] === "-c" ? args.slice(1).join(" ") : args.join(" ");
    const result = shell.run(line);
    report(result);
    return result.status;
  },
};

const report = (result) => {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
};

const repl = () => {
  let cwd = process.cwd();
  let code = 0;
  for (;;) {
    // A prompt on stderr, the way bash writes PS1, so a captured stdout holds
    // nothing but what the commands themselves printed.
    process.stderr.write("$ ");
    const line = process.stdin.readLine();
    if (line === null) break;
    const result = shell.run(line, { cwd });
    cwd = result.cwd;
    report(result);
    code = result.status;
    if (result.exited) break;
  }
  return code;
};
