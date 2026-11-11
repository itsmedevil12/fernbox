// Escape regression probes.
//
// Each of these tries a known sandbox-breaking technique against the `fernbox`
// API. Every probe must fail: none of them may reach the system context's
// globals, its `Function`, or the canary. The script reports which probes
// escaped, so a passing run prints a list of failures and no canary.

const CANARY = "SYSTEM_CONTEXT_CANARY";
const results = {};

function probe(name, fn) {
  try {
    results[name] = fn();
  } catch (e) {
    results[name] = "threw: " + e.message;
  }
}

// 1. Constructor walk: the classic. `fernbox.read` is a user-realm function,
//    so its constructor is the user's Function, not the system one. Whatever
//    this builds runs in the user context and must see no system globals.
probe("ctor-walk", () => {
  const F = fernbox.read.constructor;
  return F("return typeof __fernbox + ':' + typeof globalThis.__fernbox_secret")();
});

// 2. Prototype hijack: overwrite Function.prototype.then or similar on the
//    user side and see whether system-side code calls back through it.
probe("proto-hijack", () => {
  let stolen = null;
  const orig = Object.prototype.toString;
  Object.prototype.toString = function () {
    stolen = (typeof __fernbox) + ":" + (typeof __fernbox_secret);
    return orig.call(this);
  };
  const out = fernbox.list();
  Object.prototype.toString = orig;
  return "list=" + out.slice(0, 12) + " stolen=" + stolen;
});

// 3. Pass a hostile object as an argument. If the sandbox marshals it into the
//    system context as a real object, its getters run over there.
probe("hostile-arg", () => {
  const evil = {
    toString() {
      return "/etc/hosts";
    },
  };
  return "read=" + fernbox.read(evil);
});

// 4. Exception smuggling: throw an object across the boundary and see whether
//    the system context's catch reveals anything.
probe("throw-smuggle", () => {
  try {
    fernbox.read({
      toString() {
        throw { leak: typeof __fernbox };
      },
    });
  } catch (e) {
    return "caught: " + JSON.stringify(e);
  }
  return "no throw";
});

// 5. Direct global reach: the user context simply must not have system globals.
probe("direct-global", () => {
  return typeof __fernbox + ":" + typeof __fernbox_secret;
});

const escaped = Object.entries(results).filter(
  ([, v]) => typeof v === "string" && (v.includes(CANARY) || v.includes("object")),
);

JSON.stringify({ results, escaped });
