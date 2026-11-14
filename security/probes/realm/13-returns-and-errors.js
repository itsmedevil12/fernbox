// @title Return values, thrown errors and stack frames must belong to the user realm
const kit = require("/lib/kit.js");
const fs = require("fs");

const isEscape = { bad: (text) => String(text).indexOf("ESCAPE") === 0 && text };

function inspect(name, produce) {
  kit.safe(name, () => {
    let value;
    let how = "returned";
    try {
      value = produce();
    } catch (e) {
      value = e;
      how = "threw";
    }
    const escape = kit.escapeVia(value);
    if (escape) return "ESCAPE " + how + " value: " + escape;
    if (value !== null && typeof value === "object") {
      for (const key of Reflect.ownKeys(value)) {
        let child;
        try {
          child = value[key];
        } catch (e) {
          continue;
        }
        const inner = kit.escapeVia(child);
        if (inner) return "ESCAPE " + how + " value." + String(key) + ": " + inner;
      }
    }
    return how + " " + (value === null ? "null" : typeof value) + ", user realm";
  }, isEscape);
}

inspect("read-result", () => fernbox.read("/etc/hosts"));
inspect("read-missing-error", () => fernbox.read("/definitely/not/here"));
inspect("list-result", () => fernbox.list("/"));
inspect("stat-result", () => fernbox.fs.stat("/"));
inspect("stat-missing-error", () => fernbox.fs.stat("/definitely/not/here"));
inspect("write-result", () => fernbox.write("/tmp-returns.txt", "x"));
inspect("fetch-denied-error", () => fernbox.http.fetch("http://127.0.0.1:1/"));
inspect("fetch-bad-url-error", () => fernbox.http.fetch("not a url"));
inspect("listen-denied-error", () => fernbox.http.listen(8080, () => {}));
inspect("setTimeout-id", () => fernbox.setTimeout(() => {}, 0));
inspect("fs.statSync-result", () => fs.statSync("/"));
inspect("fs.readdirSync-result", () => fs.readdirSync("/", { withFileTypes: true }));
inspect("fs.readFileSync-buffer", () => fs.readFileSync("/etc/hosts"));
inspect("fs-error", () => fs.readFileSync("/definitely/not/here"));
inspect("require-missing-error", () => require("/definitely/not/here.js"));
inspect("execSync-error", () => require("child_process").execSync("definitely-not-a-command"));
inspect("os.userInfo-result", () => require("os").userInfo());
inspect("process.memoryUsage-result", () => process.memoryUsage());
inspect("process.hrtime-result", () => process.hrtime());

// Structured stack traces can hand out `this` and the function of each frame.
function framesOf(trigger) {
  const original = Error.prepareStackTrace;
  const limit = Error.stackTraceLimit;
  const collected = [];
  Error.stackTraceLimit = 200;
  Error.prepareStackTrace = function (error, sites) {
    for (const site of sites) {
      const frame = {};
      for (const method of ["getThis", "getFunction", "getTypeName", "getFunctionName", "getFileName", "getEvalOrigin", "getScriptNameOrSourceURL"]) {
        try {
          frame[method] = site[method]();
        } catch (e) {}
      }
      collected.push(frame);
    }
    return "frames";
  };
  try {
    try {
      trigger();
    } catch (e) {
      void e.stack;
    }
    void new Error("here").stack;
  } finally {
    Error.prepareStackTrace = original;
    Error.stackTraceLimit = limit;
  }
  return collected;
}

function stackCheck(name, trigger) {
  kit.safe(name, () => {
    const frames = framesOf(trigger);
    const files = new Set();
    for (const frame of frames) {
      for (const method of ["getThis", "getFunction"]) {
        const escape = kit.escapeVia(frame[method]);
        if (escape) return "ESCAPE frame " + frame.getFunctionName + " " + method + ": " + escape;
      }
      if (frame.getFileName) files.add(String(frame.getFileName));
    }
    return frames.length + " frames from " + Array.from(files).slice(0, 6).join(", ");
  }, isEscape);
}

stackCheck("stack:read-error", () => fernbox.read("/definitely/not/here"));
stackCheck("stack:fetch-error", () => fernbox.http.fetch("http://127.0.0.1:1/"));
stackCheck("stack:fs-error", () => fs.readFileSync("/definitely/not/here"));
stackCheck("stack:exec-error", () => require("child_process").execSync("definitely-not-a-command"));
stackCheck("stack:coercion-inside-api", () => fernbox.read({ toString() { throw new Error("from inside the bridge"); } }));

// Stack text itself may name host paths; keep it in the report so the host can scan it.
kit.safe("stack-text", () => {
  try {
    fernbox.read("/definitely/not/here");
  } catch (e) {
    return String(e.stack);
  }
  return "no error";
});

// `this` and the caller chain inside a timer callback come from the event loop.
const timerThis = kit.late("timer-callback-context", { timeoutMs: 1500, onTimeout: "error", timeoutDetail: "the timer never fired" });
setTimeout(function () {
  const escapes = [];
  const values = [["this", this]];
  for (let i = 0; i < arguments.length; i++) values.push(["arg" + i, arguments[i]]);
  try {
    values.push(["caller", arguments.callee.caller]);
  } catch (e) {}
  for (const [label, value] of values) {
    const escape = kit.escapeVia(value);
    if (escape) escapes.push(label + ": " + escape);
  }
  if (escapes.length) timerThis.fail(escapes.join("; "));
  else timerThis.pass(values.length + " values, none foreign");
}, 5);

kit.done();
