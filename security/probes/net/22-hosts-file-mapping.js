// @title SSRF: guest-written /etc/hosts mappings to forbidden addresses are refused at connect time
// @flags --deadline-ms 40000
// @finding FBX-007
const kit = require("/lib/kit.js");

// Resolution from the guest's own hosts file is by design; the boundary is the IP class
// check applied to whatever it resolves to. Each name maps to an address that must be refused.
const MAPPINGS = [
  ["fbx-loopback.test", "127.0.0.1", null],
  ["fbx-private.test", "10.0.0.1", null],
  ["fbx-metadata.test", "169.254.169.254", null],
  ["fbx-cgnat.test", "100.64.0.1", "FBX-007"],
  ["fbx-nat64.test", "64:ff9b::a9fe:a9fe", "FBX-007"],
  ["fbx-6to4.test", "2002:7f00:1::", "FBX-007"],
];

let original = "";
try {
  original = fernbox.read("/etc/hosts") || "";
} catch (e) {}

let wrote = true;
try {
  fernbox.write("/etc/hosts", original + "\n" + MAPPINGS.map((m) => m[1] + " " + m[0]).join("\n") + "\n");
} catch (e) {
  wrote = false;
  kit.pass("hosts:write", "guest cannot rewrite /etc/hosts: " + e.message);
}

if (wrote) {
  MAPPINGS.forEach(([name, ip, known]) => {
    kit.net("hosts-map:" + name + "->" + ip, "http://" + name + "/", known ? { known } : undefined);
  });
}

kit.done();
