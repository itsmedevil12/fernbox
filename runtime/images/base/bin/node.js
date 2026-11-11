// The visible seam of the stage that is not built yet. A script that shells out
// to `node` gets a named failure rather than an empty success, and the message
// says what to expect instead of leaving its author guessing.
module.exports = {
  main() {
    process.stderr.write(
      "node: virtual processes are not implemented yet; a shim is a module, so `require` it and call `main` directly\n",
    );
    return 127;
  },
};
