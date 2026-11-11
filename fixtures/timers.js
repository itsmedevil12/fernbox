// Timer behaviour: ordering, repetition, cancellation, promise interleaving,
// and a timer that clears itself.
//
// The script's return value is stringified when the top level ends, which is
// before any timer fires, so the results are written to the virtual fs from the
// last timer and read back by a second run.
const order = [];

const checks = [];
function report(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: String(detail) });
}

fernbox.setTimeout(() => order.push("one"), 30);
fernbox.setTimeout(() => order.push("two"), 10);
fernbox.setTimeout(() => order.push("three"), 20);

// setTimeout with no delay fires at the first drain.
fernbox.setTimeout(() => order.push("zero"), 0);

// An interval repeats until cleared from outside.
let ticks = 0;
const interval = fernbox.setInterval(() => {
  ticks += 1;
  if (ticks === 3) fernbox.clearInterval(interval);
}, 5);

// An interval that clears itself must not tick a second time.
let selfTicks = 0;
const selfInterval = fernbox.setInterval(() => {
  selfTicks += 1;
  fernbox.clearInterval(selfInterval);
}, 5);

// clearTimeout on a one-shot timer means it never fires.
const cancelled = fernbox.setTimeout(() => order.push("never"), 15);
fernbox.clearTimeout(cancelled);

// Promises scheduled inside a timer resolve before the next timer fires.
let promiseSeen = "none";
fernbox.setTimeout(() => {
  Promise.resolve().then(() => {
    promiseSeen = "then";
  });
  fernbox.setTimeout(() => {
    report("promise-before-next-timer", promiseSeen === "then", promiseSeen);
  }, 5);
}, 5);

// Bad arguments are an error, not a silent no-op.
try {
  fernbox.setTimeout("not a function", 5);
  report("non-function-rejected", false, "no error thrown");
} catch (e) {
  report("non-function-rejected", /function/.test(e.message), e.message);
}

// A negative delay is treated as zero.
let negative = "pending";
fernbox.setTimeout(() => (negative = "fired"), -100);
fernbox.setTimeout(
  () => report("negative-delay", negative === "fired", negative),
  5,
);

// An id is never zero, and the two clear functions share one namespace.
report("ids-are-nonzero", fernbox.setTimeout(() => {}, 0) > 0, "");

// The checkpoint: everything above is ordered by its delay.
fernbox.setTimeout(() => {
  report("ordering", order.join(",") === "zero,two,three,one", order.join(","));
  report("interval-stopped-at-three", ticks === 3, ticks);
  report("self-clearing-interval", selfTicks === 1, selfTicks);

  fernbox.write("/tmp/timer-results.json", JSON.stringify(checks, null, 1));
}, 60);

// The run stays open until the checkpoint lands; the deadline is what ends a
// run with outstanding timers, so this also confirms the run does not exit
// while timers remain.
fernbox.setTimeout(() => {}, 400);

"scheduled";
