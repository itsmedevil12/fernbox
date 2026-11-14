// @title Reach the system context's secret through globals
const kit = require("/lib/kit.js");

kit.safe("globalThis.__fernbox_secret", () => globalThis.__fernbox_secret);
kit.safe("global.__fernbox_secret", () => global.__fernbox_secret);
kit.safe("sloppy-this", () => (function () { return this; })().__fernbox_secret);
kit.safe("indirect-eval-this", () => (0, eval)("this").__fernbox_secret);
kit.safe("Function-return-this", () => Function("return this")().__fernbox_secret);
kit.safe("bare-identifier", () => (0, eval)("typeof __fernbox_secret === 'undefined' ? undefined : __fernbox_secret"));
kit.safe("bare-__fernbox", () => (0, eval)("typeof __fernbox === 'undefined' ? undefined : Object.keys(__fernbox)"), {
  bad: (value) => value !== undefined && "the system-side __fernbox object is visible in the user realm",
});

kit.holds("eval-global-is-ours", () => (0, eval)("this") === globalThis);
kit.holds("Function-global-is-ours", () => Function("return this")() === globalThis);
kit.holds("async-Function-global-is-ours", () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const GeneratorFunction = Object.getPrototypeOf(function* () {}).constructor;
  return GeneratorFunction("return this")().next().value === globalThis && typeof AsyncFunction === "function";
});

// Every global, every own key, any string that smells like the canary.
kit.safe("scan-all-globals", () => {
  const seen = new Set();
  const found = [];
  const visit = (value, trail, depth) => {
    if (typeof value === "string") {
      if (value.indexOf(kit.CANARY) !== -1) found.push(trail + "=" + value);
      return;
    }
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
    if (seen.has(value) || depth > 3) return;
    seen.add(value);
    let keys = [];
    try {
      keys = Reflect.ownKeys(value);
    } catch (e) {}
    for (const key of keys) {
      let child;
      try {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        child = descriptor && "value" in descriptor ? descriptor.value : undefined;
      } catch (e) {
        continue;
      }
      visit(child, trail + "." + String(key), depth + 1);
    }
  };
  visit(globalThis, "globalThis", 0);
  return found.length ? found.join("; ") : "scanned " + seen.size + " objects, canary not found";
});

kit.safe("hidden-global-names", () => Reflect.ownKeys(globalThis).map(String).filter((key) => /fernbox|secret|internal|bridge|native/i.test(key)), {
  soft: true,
  bad: (names) => names.some((name) => name !== "fernbox") && "unexpected bridge-like globals: " + names.join(", "),
});

kit.done();
