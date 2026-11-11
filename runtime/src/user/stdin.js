// A readable `stdin` over a plain string.
//
// The sandbox has no file descriptors and no real pipe, so input is whatever a
// caller handed the run: what was piped to the top level, and the `input` option
// a simulated `exec` passes its child. It is consumed as it is read, the way a
// pipe's buffer drains — a shell reading a line does not get the same line
// twice.

export function makeStdin(text = "") {
  let remaining = text;

  const self = {
    isTTY: false,

    // The whole remainder at once, and gone afterwards; `null` at EOF is the
    // signal a prompt loop terminates on.
    read() {
      const out = remaining;
      remaining = "";
      return out.length ? out : null;
    },

    // One line without its newline, or `null` when the input is exhausted. A
    // final line with no trailing newline is still a line.
    readLine() {
      if (!remaining) return null;
      const at = remaining.indexOf("\n");
      if (at < 0) {
        const line = remaining;
        remaining = "";
        return line;
      }
      const line = remaining.slice(0, at);
      remaining = remaining.slice(at + 1);
      return line;
    },

    // The pieces a dependency probes at import time. Nothing here is async, so
    // these are the shape rather than a scheduler.
    on: () => self,
    once: () => self,
    removeListener: () => self,
    setEncoding: () => self,
  };

  return self;
}
