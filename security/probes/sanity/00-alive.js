// @title The sandbox runs probes and reports back
const kit = require("/lib/kit.js");
const fs = require("fs");

kit.holds("arithmetic", () => 1 + 1 === 2);
kit.holds("fernbox-api-present", () => typeof fernbox === "object" && typeof fernbox.read === "function");
kit.holds("virtual-fs-roundtrip", () => {
  fs.writeFileSync("/tmp-sanity.txt", "hello");
  return fs.readFileSync("/tmp-sanity.txt", "utf8") === "hello";
});
kit.holds("probe-env-delivered", () => typeof process.env.SEC_HOST_CANARY_PATH === "string" && process.env.SEC_HOST_CANARY_PATH.length > 0);
kit.holds("user-realm-has-no-secret", () => typeof globalThis.__fernbox_secret === "undefined");

const timer = kit.late("timers-fire");
setTimeout(() => timer.pass("setTimeout callback ran"), 10);

kit.info("runtime", { node: process.version, platform: process.platform, argv: process.argv.length });
kit.done();
