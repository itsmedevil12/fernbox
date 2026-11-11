// `console`. Node's own uses `util.inspect`, which is more machinery than a
// sandbox needs; this formats each argument plainly and joins them with
// spaces, which is what an author reading the output actually wrote.

export function makeConsole(process) {
  const show = (value, seen = new Set()) => {
    if (typeof value === "string") return value;
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (value instanceof Error) return value.stack ?? value.message ?? String(value);
    if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value !== "object") return String(value);
    // A circular structure would stringify forever; the set is per-call, so a
    // shared reference two siblings share is not mistaken for a cycle.
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    if (Array.isArray(value)) return `[${value.map((v) => show(v, seen)).join(",")}]`;
    try {
      return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? `${v}` : v));
    } catch {
      return String(value);
    }
  };

  // The stream is looked up as the line is written, not bound at construction,
  // the way Node's `console._stdout` getter returns the *current*
  // `process.stdout`. A simulated child runs with the streams swapped onto
  // capturing sinks, and a `console.log` inside it must land in the child's
  // capture, not the parent's.
  const emit = (which) => (...args) => {
    process[which].write(`${args.map((a) => show(a)).join(" ")}\n`);
  };

  return {
    log: emit("stdout"),
    info: emit("stdout"),
    debug: emit("stdout"),
    // Diagnostics belong on the other stream, so a captured stdout stays clean.
    error: emit("stderr"),
    warn: emit("stderr"),
    trace: emit("stderr"),
    dir: (obj) => process.stdout.write(`${show(obj)}\n`),
    // A table nobody formats by hand still wants its rows, not "[object Object]".
    table: (rows) => {
      for (const row of rows ?? []) process.stdout.write(`${show(row)}\n`);
    },
    assert: (condition, ...args) => {
      if (condition) return;
      process.stderr.write(`Assertion failed${args.length ? `: ${args.map(show).join(" ")}` : ""}\n`);
    },
  };
}
