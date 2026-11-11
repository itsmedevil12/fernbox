// Canary hunt: a battery of direct attempts to read the system-context secret.
// Every one must fail. Any probe that returns the canary string is a real
// escape and a Stage 1 blocker.

const CANARY = "SYSTEM_CONTEXT_CANARY";
const probes = {};

function probe(name, fn) {
  try {
    probes[name] = String(fn());
  } catch (e) {
    probes[name] = "threw: " + e.message;
  }
}

// Thefernbox function's own internals.
probe("fn-source", () => fernbox.read.toString());
probe("fn-name", () => fernbox.read.name);
probe("fn-ctor-call", () => fernbox.read.constructor("return globalThis.__fernbox_secret")());
probe("fn-ctor-this", () => {
  const F = fernbox.read.constructor;
  return new F("return __fernbox_secret")();
});

// Bind/apply tricks.
probe("bind-leak", () => fernbox.read.bind(null)("/etc/hosts"));
probe("call-apply", () => fernbox.read.call(null, "/etc/hosts"));

// Symbol and well-known intrinsics.
probe("symbol-hasInstance", () => {
  const obj = Object.create(fernbox.read);
  return obj instanceof fernbox.read;
});

// Proxy trap on the API object. `fernb ox` is frozen, so this must fail.
probe("proxy-wrap", () => {
  const p = new Proxy(fernbox, {
    get(t, k) {
      return k === "__fernbox_secret" ? t[k] : t[k];
    },
  });
  return p.read("/etc/hosts");
});

// Walk the prototype chain of the API object looking for anything from the
// system realm.
probe("proto-chain", () => {
  let o = fernbox;
  let found = [];
  for (let i = 0; i < 10 && o; i++) {
    found.push(Object.getOwnPropertyNames(o).join(","));
    o = Object.getPrototypeOf(o);
  }
  return found.join(" | ");
});

const leaked = Object.values(probes).filter((v) => v.includes(CANARY));

JSON.stringify({ leaked, probes });
