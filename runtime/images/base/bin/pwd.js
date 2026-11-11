// `pwd`. The virtual process has one working directory for its whole life, so
// this is a print of `process.cwd()`.
module.exports = {
  main() {
    process.stdout.write(`${process.cwd()}\n`);
    return 0;
  },
};
