// @title Climb constructors of every reachable function to a foreign realm
const kit = require("/lib/kit.js");

const BUILTINS = [
  "fs", "path", "os", "http", "http2", "https", "shell", "child_process", "stream", "buffer", "events", "util",
  "assert", "async_hooks", "diagnostics_channel", "dns", "module", "url", "querystring", "string_decoder", "tty",
  "crypto", "zlib", "net", "tls", "timers", "worker_threads", "sys", "util/types", "timers/promises", "fs/promises",
];

// Walks the object graph under `root` and tries to escape through each object it meets.
function walk(root, limit) {
  const seen = new Set();
  const queue = [{ value: root, trail: "", depth: 0 }];
  const escapes = [];
  let functions = 0;
  while (queue.length && seen.size < limit) {
    const { value, trail, depth } = queue.shift();
    if (value === null || (typeof value !== "object" && typeof value !== "function")) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    if (typeof value === "function") functions++;
    const escape = kit.escapeVia(value);
    if (escape) escapes.push((trail || "<root>") + ": " + escape);
    if (depth >= 4) continue;
    let keys = [];
    try {
      keys = Reflect.ownKeys(value);
    } catch (e) {}
    for (const key of keys) {
      let descriptor;
      try {
        descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      } catch (e) {
        continue;
      }
      if (!descriptor) continue;
      const name = trail + "." + String(key);
      if ("value" in descriptor) queue.push({ value: descriptor.value, trail: name, depth: depth + 1 });
      if (descriptor.get) queue.push({ value: descriptor.get, trail: name + "<get>", depth: depth + 1 });
      if (descriptor.set) queue.push({ value: descriptor.set, trail: name + "<set>", depth: depth + 1 });
    }
    try {
      queue.push({ value: Object.getPrototypeOf(value), trail: trail + ".__proto__", depth: depth + 1 });
    } catch (e) {}
  }
  return { escapes, objects: seen.size, functions };
}

function walkCheck(name, getRoot) {
  kit.safe("walk:" + name, () => {
    const result = walk(getRoot(), 4000);
    if (result.escapes.length) return "ESCAPE " + result.escapes.slice(0, 3).join("; ");
    return result.objects + " objects, " + result.functions + " functions, no foreign realm";
  }, { bad: (text) => text.indexOf("ESCAPE") === 0 && text });
}

walkCheck("fernbox", () => fernbox);
walkCheck("process", () => process);
walkCheck("console", () => console);
walkCheck("require", () => require);
walkCheck("Buffer", () => Buffer);
walkCheck("timers", () => ({ setTimeout, setInterval, setImmediate, clearTimeout, queueMicrotask }));
walkCheck("module-object", () => (typeof module === "undefined" ? {} : module));
for (const name of BUILTINS) walkCheck("require(" + name + ")", () => require(name));

// The direct, well-known spellings.
kit.safe("fernbox.read.constructor", () => fernbox.read.constructor("return globalThis.__fernbox_secret")());
kit.safe("fernbox.constructor.constructor", () => fernbox.constructor.constructor("return globalThis.__fernbox_secret")());
kit.safe("fernbox.__proto__.constructor", () => Object.getPrototypeOf(fernbox).constructor.constructor("return globalThis.__fernbox_secret")());
kit.safe("fernbox.http.fetch.bind", () => fernbox.http.fetch.bind.constructor("return globalThis.__fernbox_secret")());
kit.safe("fernbox.read.call.call", () => Function.prototype.call.call(fernbox.read.constructor, null, "return globalThis.__fernbox_secret")());
kit.safe("console.log.constructor", () => console.log.constructor("return globalThis.__fernbox_secret")());
kit.safe("require.constructor", () => require.constructor("return globalThis.__fernbox_secret")());
kit.safe("process.constructor.constructor", () => process.constructor.constructor("return globalThis.__fernbox_secret")());

kit.done();
