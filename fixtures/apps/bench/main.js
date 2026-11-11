// A light benchmark of what the sandbox adds on top of V8, not of V8: the
// two-context boundary, the virtual fs, and the simulated shell. Raw JS speed
// is the same engine Node uses, so the control below is the only number that
// says anything about the engine; every other one is a crossing.
const fs = require("fs");
const { execSync } = require("child_process");

// `Date` is in the isolate's snapshot, so a wall clock is available; a run that
// cannot see one reports that rather than pretending to have timed anything.
const clock = typeof Date.now === "function" ? Date.now : null;

const results = {};
const bench = (name, iterations, fn) => {
  if (!clock) {
    results[name] = "no clock";
    return;
  }
  // One untimed pass first, so a first-call allocation or a module load is not
  // charged to the thing being measured.
  fn(0);
  const start = clock();
  for (let i = 0; i < iterations; i++) fn(i);
  const ms = clock() - start;
  results[name] = { ms, per_op_us: ((ms * 1000) / iterations).toFixed(2), iterations };
};

const N_FS = 20000;
const N_SHELL = 2000;

// Pure JS, no crossing at all: the floor everything else is compared against.
bench("json round trip (control)", N_FS, () => {
  JSON.stringify({ a: 1, b: "text", c: [1, 2, 3] });
  JSON.parse('{"a":1,"b":"text","c":[1,2,3]}');
});

// The chokepoint itself: a read through the frozen `fernbox` object, with no
// fs builtin on top of it.
fs.writeFileSync("/bench/small.txt", "abcdefghij");
bench("chokepoint read", N_FS, () => globalThis.fernbox.read("/bench/small.txt"));

// The fs builtin is the same crossing plus a JSON envelope and a throw check.
bench("fs.readFileSync", N_FS, () => fs.readFileSync("/bench/small.txt", "utf8"));
bench("fs.writeFileSync", N_FS, (i) => fs.writeFileSync("/bench/count.txt", String(i)));

// The simulated shell: each `execSync` swaps the streams, resolves a command,
// and loads or finds the shim in the module cache. The first call pays the
// load; the rest are what an app that shells out in a loop actually costs.
bench('execSync("echo hi")', N_SHELL, () => execSync("echo hi"));

JSON.stringify(results, null, 1);
