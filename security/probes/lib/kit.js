// Shared helpers for the in-sandbox probes. Every probe ends with `kit.done();`
// so the JSON report becomes the run's completion value.

var CANARY = "SYSTEM_" + "CONTEXT_CANARY";
var LATE_PREFIX = "@@KIT ";

var checks = [];
var pending = [];
var settled = {};

// Captured up front so probes that tamper with intrinsics cannot break reporting.
var jsonStringify = JSON.stringify;
var stringOf = String;
var realGlobal = globalThis;
var consoleLog = console.log.bind(console);

function clip(text, max) {
  text = stringOf(text);
  max = max || 240;
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function show(value) {
  try {
    if (typeof value === "string") return value;
    if (typeof value === "function") return "[function " + (value.name || "anonymous") + "]";
    if (typeof value === "symbol") return value.toString();
    var json = jsonStringify(value);
    return json === undefined ? stringOf(value) : json;
  } catch (e) {
    try {
      return stringOf(value);
    } catch (e2) {
      return "[unprintable]";
    }
  }
}

function message(error) {
  try {
    if (error && typeof error === "object" && "message" in error) return stringOf(error.message);
    return stringOf(error);
  } catch (e) {
    return "[unprintable error]";
  }
}

function record(name, status, detail, opts) {
  var entry = { name: name, status: status, detail: clip(detail == null ? "" : detail) };
  if (opts && opts.known) entry.known = opts.known;
  checks.push(entry);
  return entry;
}

function failStatus(opts) {
  return opts && opts.soft ? "warn" : "fail";
}

// Passes only when `fn` throws: the sandbox refused the operation.
function denied(name, fn, opts) {
  var value;
  try {
    value = fn();
  } catch (e) {
    return record(name, "pass", "refused: " + message(e), opts);
  }
  return record(name, failStatus(opts), "allowed, returned: " + show(value), opts);
}

// Passes unless the result carries the system canary or `opts.bad(value)` says it is bad.
// The clipped result is kept in the report so the host can scan it for host secrets.
function safe(name, fn, opts) {
  var value;
  try {
    value = fn();
  } catch (e) {
    return record(name, "pass", "threw: " + message(e), opts);
  }
  var text = show(value);
  if (text.indexOf(CANARY) !== -1) return record(name, "fail", "leaked the system canary: " + text, opts);
  var verdict = false;
  try {
    verdict = opts && opts.bad ? opts.bad(value, text) : false;
  } catch (e) {
    return record(name, "error", "bad() threw: " + message(e), opts);
  }
  if (verdict) {
    return record(name, failStatus(opts), typeof verdict === "string" ? verdict : "returned: " + text, opts);
  }
  return record(name, "pass", "returned: " + text, opts);
}

// Passes only when `fn` returns true. A throw is a probe error, not a finding.
function holds(name, fn, opts) {
  var value;
  try {
    value = fn();
  } catch (e) {
    return record(name, "error", "threw: " + message(e), opts);
  }
  if (value === true) return record(name, "pass", "", opts);
  return record(name, failStatus(opts), typeof value === "string" ? value : "got: " + show(value), opts);
}

function info(name, detail) {
  return record(name, "info", show(detail));
}

function pass(name, detail, opts) {
  return record(name, "pass", detail, opts);
}

function fail(name, detail, opts) {
  return record(name, failStatus(opts), detail, opts);
}

// A fetch passes only if policy refused it before any connection was attempted.
function net(name, url, opts) {
  var response;
  try {
    response = fernbox.http.fetch(url, (opts && opts.fetch) || {});
  } catch (e) {
    var text = message(e);
    if (/denied|host not found|bad url|bad method|unsupported scheme/i.test(text)) {
      return record(name, "pass", "refused: " + text, opts);
    }
    return record(name, failStatus(opts), "connection attempted: " + text, opts);
  }
  return record(name, failStatus(opts), "got a response: " + show(response), opts);
}

// Tries to climb from any value to a global object that is not ours.
function foreignGlobal(value) {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
  var routes = [
    function () { return value.constructor("return this")(); },
    function () { return value.constructor.constructor("return this")(); },
    function () { return Object.getPrototypeOf(value).constructor.constructor("return this")(); },
    function () { return Reflect.getPrototypeOf(value).constructor("return this")(); },
  ];
  for (var i = 0; i < routes.length; i++) {
    try {
      var found = routes[i]();
      if (found && typeof found === "object" && found !== realGlobal) return found;
    } catch (e) {}
  }
  return null;
}

// Returns a description of the escape if `value` gives access to another realm, else null.
function escapeVia(value) {
  var other = foreignGlobal(value);
  if (!other) return null;
  var secret;
  try {
    secret = other.__fernbox_secret;
  } catch (e) {}
  return "reached a foreign global" + (secret ? " holding " + stringOf(secret) : "");
}

// Asynchronous check: the verdict is printed on stdout once it is known.
function late(name, opts) {
  opts = opts || {};
  pending.push(name);
  function settle(status, detail) {
    if (settled[name]) return;
    settled[name] = true;
    var entry = { name: name, status: status, detail: clip(detail == null ? "" : detail) };
    if (opts.known) entry.known = opts.known;
    consoleLog(LATE_PREFIX + jsonStringify(entry));
  }
  if (opts.timeoutMs) {
    setTimeout(function () {
      settle(opts.onTimeout || "pass", opts.timeoutDetail || "nothing happened");
    }, opts.timeoutMs);
  }
  return {
    pass: function (detail) { settle("pass", detail); },
    fail: function (detail) { settle(failStatus(opts), detail); },
    info: function (detail) { settle("info", detail); },
  };
}

function done() {
  return jsonStringify({ kit: 1, checks: checks, pending: pending });
}

// ---------------------------------------------------------------- SECURITY.md section 6 suites
//
// The suites below are the ones from the regression table that can run inside the
// guest. The rest need the host (control-socket floods, daemon.json permissions,
// worker env, lock races, a mock registry or gate peer) and belong in security/host.

// escape_probe / escape_canary (I1): no reachable value may lead to another realm.
function escapeSuite() {
  var roots = {
    fernbox: realGlobal.fernbox,
    "fernbox.fs": realGlobal.fernbox && realGlobal.fernbox.fs,
    "fernbox.http": realGlobal.fernbox && realGlobal.fernbox.http,
    "fernbox.stdio": realGlobal.fernbox && realGlobal.fernbox.stdio,
    require: realGlobal.require,
    process: realGlobal.process,
    console: realGlobal.console,
    setTimeout: realGlobal.setTimeout,
    Buffer: realGlobal.Buffer,
  };
  Object.keys(roots).forEach(function (key) {
    safe("escape:" + key, function () { return typeof roots[key]; }, {
      bad: function () { return escapeVia(roots[key]); },
    });
  });
  safe("escape:thrown-error", function () {
    try { realGlobal.fernbox.read({}); } catch (e) { return escapeVia(e) || "contained"; }
    return "contained";
  }, { bad: function (v) { return v !== "contained" && v; } });
  holds("escape:canary-not-on-global", function () {
    return typeof realGlobal.__fernbox_secret === "undefined" || "__fernbox_secret is visible";
  });
}

// ssrf_special_ranges (FBX-007 / I5): special-use addresses must be refused before connecting.
var SPECIAL_HOSTS = [
  "100.64.0.1", "100.100.100.100", "198.18.0.1", "224.0.0.1",
  "[64:ff9b::a9fe:a9fe]", "[2002:7f00:1::]",
];

function ssrfSuite(opts) {
  opts = opts || { known: "FBX-007" };
  SPECIAL_HOSTS.forEach(function (host) {
    net("ssrf:" + host, "http://" + host + "/", opts);
  });
}

// volume_mount_confinement (FBX-001 / I2): dot-segment writes must not leave `mount`.
// Needs a volume mounted at `mount`; the host-side check of volumes/<name>.json is `@host volume-confined`.
function volumeSuite(mount, opts) {
  opts = opts || { known: "FBX-001" };
  if (!mount) return info("volume-confinement", "no mount given; nothing to test");
  var escapes = [
    [mount + "/../kit-escape.txt", "/kit-escape.txt"],
    [mount + "/../etc/kit-escape.txt", "/etc/kit-escape.txt"],
    [mount + "/./../kit-escape2.txt", "/kit-escape2.txt"],
  ];
  escapes.forEach(function (pair) {
    holds("volume:" + pair[0], function () {
      try { realGlobal.fernbox.write(pair[0], "kit"); } catch (e) { return true; }
      try {
        realGlobal.fernbox.read(pair[1]);
        return "write escaped " + mount + " and landed at " + pair[1];
      } catch (e) {
        return true;
      }
    }, opts);
  });
}

// native_buffer_caps (FBX-006): output must hit a bound long before host memory does.
// Run this in its own probe with a short deadline; it floods stderr by design.
function bufferCapSuite(opts) {
  opts = opts || { known: "FBX-006" };
  var chunk = new Array(1024 * 1024 + 1).join("x");
  var limit = 256;
  var bounded = false;
  var written = 0;
  try {
    for (var i = 0; i < limit; i++) {
      realGlobal.fernbox.stdio.write(chunk, "stderr");
      written++;
    }
  } catch (e) {
    bounded = true;
  }
  record(
    "buffer-cap:stdio",
    bounded ? "pass" : failStatus(opts),
    bounded ? "refused after " + written + " MiB" : "accepted " + written + " MiB without a bound",
    opts
  );
}

module.exports = {
  CANARY: CANARY,
  clip: clip,
  show: show,
  message: message,
  denied: denied,
  safe: safe,
  holds: holds,
  info: info,
  pass: pass,
  fail: fail,
  net: net,
  late: late,
  foreignGlobal: foreignGlobal,
  escapeVia: escapeVia,
  escapeSuite: escapeSuite,
  ssrfSuite: ssrfSuite,
  volumeSuite: volumeSuite,
  bufferCapSuite: bufferCapSuite,
  done: done,
};
