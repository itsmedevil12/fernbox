import http from "node:http";
import zlib from "node:zlib";
import { freePort, tempApp } from "../lib/hostkit.mjs";

export const meta = {
  title: "npm shim: tar-slip members cannot leave the package dir, symlinks are dropped, gzip bombs are bounded",
  finding: "FBX-003",
};

const KNOWN = { known: "FBX-003" };
const BOMB_BYTES = 64 * 1024 * 1024;

const octal = (value, width) => value.toString(8).padStart(width - 1, "0") + "\0";

function tarEntry(name, data, type = "0", linkname = "") {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write(octal(0o644, 8), 100, 8, "latin1");
  header.write(octal(0, 8), 108, 8, "latin1");
  header.write(octal(0, 8), 116, 8, "latin1");
  header.write(octal(data.length, 12), 124, 12, "latin1");
  header.write(octal(0, 12), 136, 12, "latin1");
  header.fill(0x20, 148, 156);
  header.write(type, 156, 1, "latin1");
  header.write(linkname, 157, 100, "utf8");
  header.write("ustar\0", 257, 6, "latin1");
  header.write("00", 263, 2, "latin1");
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "latin1");
  const padding = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([header, data, padding]);
}

const tarball = (entries) => zlib.gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]));
const text = (value) => Buffer.from(value);
const manifest = (name) => tarEntry("package/package.json", text(JSON.stringify({ name, version: "1.0.0" })));

const PACKAGES = {
  "fbx-slip": () =>
    tarball([
      manifest("fbx-slip"),
      tarEntry("package/../../etc/fbx-slip", text("pwned")),
      tarEntry("package/../../etc/hosts", text("6.6.6.6 attacker.test\n")),
      tarEntry("package/../../../fbx-root", text("pwned")),
      tarEntry("package/../victim/index.js", text("OVERWRITTEN")),
    ]),
  "fbx-link": () =>
    tarball([manifest("fbx-link"), tarEntry("package/link", Buffer.alloc(0), "2", "/etc/hosts"), tarEntry("package/hard", Buffer.alloc(0), "1", "/etc/hosts")]),
  "fbx-bomb": () => tarball([manifest("fbx-bomb"), tarEntry("package/big.txt", Buffer.alloc(BOMB_BYTES, 0x61))]),
};

const GUEST = `
const fs = require("fs");
const name = process.env.PKG;
const result = { name, escaped: [] };
const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };
fs.mkdirSync("/node_modules/victim", { recursive: true });
fs.writeFileSync("/node_modules/victim/index.js", "SAFE");
const hostsBefore = read("/etc/hosts");
try {
  result.code = require("/bin/npm.js").main(["install", name, "--registry=" + process.env.REG]);
} catch (error) {
  result.error = String(error && error.message).slice(0, 200);
}
if (fs.existsSync("/etc/fbx-slip")) result.escaped.push("/etc/fbx-slip");
if (fs.existsSync("/fbx-root")) result.escaped.push("/fbx-root");
if (read("/etc/hosts") !== hostsBefore) result.escaped.push("/etc/hosts");
if (read("/node_modules/victim/index.js") !== "SAFE") result.escaped.push("/node_modules/victim/index.js");
for (const rel of ["link", "hard"]) if (fs.existsSync("/node_modules/" + name + "/" + rel)) result.escaped.push("link:" + rel);
try { result.bombBytes = fs.statSync("/node_modules/" + name + "/big.txt").size; } catch {}
console.log("RESULT " + JSON.stringify(result));
`;

function startRegistry(port) {
  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const tarMatch = /^\/tarballs\/([\w-]+)\.tgz$/.exec(url);
    if (tarMatch && PACKAGES[tarMatch[1]]) {
      const body = PACKAGES[tarMatch[1]]();
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": body.length });
      return res.end(body);
    }
    const name = url.slice(1);
    if (PACKAGES[name]) {
      const doc = {
        name,
        "dist-tags": { latest: "1.0.0" },
        versions: { "1.0.0": { name, version: "1.0.0", dist: { tarball: `http://127.0.0.1:${port}/tarballs/${name}.tgz` } } },
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(doc));
    }
    res.writeHead(404);
    res.end("{}");
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

export async function run(ctx) {
  const port = await freePort();
  const server = await startRegistry(port);
  try {
    const app = tempApp(ctx, { "main.js": GUEST });
    const install = async (pkg) => {
      const result = await ctx.cli(
        [
          "--state-dir", ctx.stateDir, "run", app, "--entrypoint", "main.js", "--allow-loopback",
          "--env", `PKG=${pkg}`, "--env", `REG=http://127.0.0.1:${port}`, "--deadline-ms", "20000",
        ],
        { wallMs: 45000 },
      );
      const line = /^RESULT (.*)$/m.exec(result.stdout);
      return { result, report: line ? JSON.parse(line[1]) : null };
    };

    const slip = await install("fbx-slip");
    if (!slip.report) ctx.check.error("npm:slip-run", `no result from the guest (exit ${slip.result.code}): ${slip.result.stderr.slice(-200)}`);
    else if (slip.report.escaped.length) {
      ctx.check.fail("npm:tar-slip", `members escaped the package directory: ${slip.report.escaped.join(", ")}`, KNOWN);
    } else ctx.check.pass("npm:tar-slip", `no member escaped /node_modules/fbx-slip (npm exit ${slip.report.code ?? slip.report.error})`);

    const link = await install("fbx-link");
    if (!link.report) ctx.check.error("npm:link-run", `no result from the guest (exit ${link.result.code}): ${link.result.stderr.slice(-200)}`);
    else if (link.report.escaped.length) ctx.check.fail("npm:links", `link entries were materialised: ${link.report.escaped.join(", ")}`, KNOWN);
    else ctx.check.pass("npm:links", "symlink and hardlink members were dropped");

    const bomb = await install("fbx-bomb");
    const { result, report } = bomb;
    if (report && report.bombBytes >= BOMB_BYTES) {
      ctx.check.fail("npm:gzip-bomb", `a ${BOMB_BYTES >> 20} MiB decompressed member was installed in full; no cap`, KNOWN);
    } else if (report) {
      ctx.check.pass("npm:gzip-bomb", `npm refused the oversized member: ${report.error || `exit ${report.code}`}`);
    } else if (result.timedOut || result.code === 2 || result.code === 4) {
      ctx.check.warn(
        "npm:gzip-bomb",
        `no size cap; the run was ended by ${result.timedOut ? "the wall clock" : result.code === 2 ? "the deadline" : "the heap limit"} instead (exit ${result.code})`,
        KNOWN,
      );
    } else {
      ctx.check.error("npm:gzip-bomb", `unexpected outcome, exit ${result.code}: ${result.stderr.slice(-200)}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
