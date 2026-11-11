// `printenv`. With names it prints each value and exits 1 for the first one that
// is not set, the way the real one does; with none it dumps the environment.
module.exports = {
  main(args) {
    if (args.length === 0) {
      for (const [key, value] of Object.entries(process.env)) {
        process.stdout.write(`${key}=${value}\n`);
      }
      return 0;
    }
    let code = 0;
    for (const name of args) {
      const value = process.env[name];
      if (value === undefined) {
        code = 1;
        continue;
      }
      process.stdout.write(`${value}\n`);
    }
    return code;
  },
};
