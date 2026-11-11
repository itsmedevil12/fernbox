// `whoami`. The sandbox has one identity and it is not the host user's, so the
// answer is a name of its own rather than a lookup that would report whoever
// happened to be running the daemon.
module.exports = {
  main() {
    process.stdout.write("fernbox\n");
    return 0;
  },
};
