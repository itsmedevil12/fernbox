// `env`. With no arguments it prints the environment; with `NAME=VALUE` pairs
// before a command it runs that command with the changes applied, the way a
// service's entrypoint gets its configuration. The command goes through the
// shell's own runner, so it inherits the capture, the cwd and the deadline this
// `env` is itself running under.
const shell = require("shell");

const isAssignment = (arg) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(arg);

module.exports = {
  main(args) {
    const changes = {};
    let i = 0;
    for (; i < args.length && isAssignment(args[i]); i++) {
      const at = args[i].indexOf("=");
      changes[args[i].slice(0, at)] = args[i].slice(at + 1);
    }
    const words = args.slice(i);

    if (words.length === 0) {
      for (const [name, value] of Object.entries({ ...process.env, ...changes }).sort()) {
        process.stdout.write(`${name}=${value}\n`);
      }
      return 0;
    }

    const [file, ...rest] = words;
    const result = shell.runArgv(file, rest, { env: changes });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return result.status;
  },
};
