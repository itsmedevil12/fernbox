import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { sleep, startCli, tempApp, tmpDir, waitFor } from "../lib/hostkit.mjs";

export const meta = {
  title: "Daemon secrets: daemon.json is never group/world readable, workers do not inherit env or descriptors",
  finding: "FBX-009",
};

const SENTINEL = "fbx-host-secret-3f9a1c7e";
const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";

const DUMP_APP = `
const out = { env: {} };
for (const [k, v] of Object.entries(process.env)) out.env[k] = String(v);
console.log("RESULT " + JSON.stringify(out));
`;

const SPIN_APP = `
const end = Date.now() + 7000;
while (Date.now() < end) {}
console.log("done");
`;

function childrenOf(pid) {
  const found = [];
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${entry}/stat`, "utf8");
      const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      if (Number(rest[1]) === pid) found.push(Number(entry));
    } catch {}
  }
  return found;
}

export async function run(ctx) {
  const stateDir = tmpDir("fbx-sec-perm-");
  const infoPath = path.join(stateDir, "daemon.json");
  const daemonArgs = ["--state-dir", stateDir, "serve", "--port", "0"];
  const env = { ...process.env, FERNBOX_WORKER: ctx.bins.worker, FERNBOX_TEST_HOST_SECRET: SENTINEL };

  const child = isWindows
    ? spawn(ctx.bins.daemon, daemonArgs, { env, stdio: "ignore", windowsHide: true })
    : spawn("sh", ["-c", 'umask 000; exec "$0" "$@"', ctx.bins.daemon, ...daemonArgs], { env, stdio: "ignore" });

  try {
    // Busy-poll so a chmod that happens after creation is caught in the gap.
    let firstMode = null;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 20000 && firstMode === null) {
      try {
        firstMode = fs.statSync(infoPath).mode & 0o777;
      } catch {
        if (child.exitCode !== null) break;
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    if (firstMode === null) {
      ctx.check.error("perm:daemon-start", "private daemon never wrote daemon.json");
      return;
    }
    if (isWindows) {
      ctx.check.info("perm:daemon-json-mode", "POSIX modes do not apply on Windows; check the ACL manually");
    } else if ((firstMode & 0o077) === 0) {
      ctx.check.pass("perm:daemon-json-mode", `daemon.json first appeared with mode ${firstMode.toString(8)} under umask 000`);
    } else {
      ctx.check.fail(
        "perm:daemon-json-mode",
        `daemon.json first appeared with mode ${firstMode.toString(8)}; the token was readable before chmod`,
        { known: "FBX-009" },
      );
    }

    const ready = await waitFor(
      () => {
        try {
          const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
          return Boolean(info.port && info.token);
        } catch {
          return false;
        }
      },
      { timeoutMs: 15000 },
    );
    if (!ready) {
      ctx.check.error("perm:daemon-ready", "daemon.json never became complete");
      return;
    }

    // Environment inheritance.
    const dumpDir = tempApp(ctx, { "main.js": DUMP_APP });
    const dump = await new Promise((resolve) => {
      const cli = startCli(ctx, ["run", dumpDir, "--entrypoint", "main.js", "--deadline-ms", "15000"], { stateDir });
      const timer = setTimeout(() => cli.kill(), 30000);
      cli.exited.then(() => {
        clearTimeout(timer);
        resolve(cli);
      });
    });
    const line = /RESULT (.*)/.exec(dump.stdout);
    const leaked = dump.stdout.includes(SENTINEL) || dump.stderr.includes(SENTINEL);
    if (!line && !leaked) ctx.check.error("env:run", `env dump app produced no result; stderr: ${dump.stderr.slice(-200)}`);
    else if (leaked) ctx.check.fail("env:guest-visible", "the host secret from the daemon environment is visible inside the sandbox", { known: "FBX-009" });
    else ctx.check.pass("env:guest-visible", "daemon environment is not visible to guest code");

    // Worker process inheritance (Linux only).
    if (!isLinux) {
      ctx.check.info("worker:proc-inspect", "worker environ/fd inspection needs /proc; Linux only");
      return;
    }
    const spinDir = tempApp(ctx, { "main.js": SPIN_APP });
    const spin = startCli(ctx, ["run", spinDir, "--entrypoint", "main.js", "--deadline-ms", "20000"], { stateDir });
    try {
      let workers = [];
      await waitFor(
        () => {
          workers = childrenOf(child.pid);
          return workers.length > 0;
        },
        { timeoutMs: 10000, stepMs: 50 },
      );
      if (workers.length === 0) {
        ctx.check.error("worker:find", "no worker process found under the daemon");
        return;
      }
      await sleep(300);
      for (const pid of workers) {
        let environ = "";
        try {
          environ = fs.readFileSync(`/proc/${pid}/environ`, "latin1");
        } catch (error) {
          ctx.check.info(`worker:${pid}:environ`, `unreadable: ${error.code}`);
        }
        if (environ.includes(SENTINEL)) {
          ctx.check.fail(`worker:${pid}:environ`, "worker process inherited the daemon's environment", { known: "FBX-009" });
        } else {
          ctx.check.pass(`worker:${pid}:environ`, "worker environment does not contain the daemon secret");
        }

        const suspicious = [];
        try {
          for (const fd of fs.readdirSync(`/proc/${pid}/fd`)) {
            let target = "";
            try {
              target = fs.readlinkSync(`/proc/${pid}/fd/${fd}`);
            } catch {
              continue;
            }
            if (Number(fd) <= 2) continue;
            if (target.startsWith("socket:") || target.startsWith(stateDir)) suspicious.push(`${fd}->${target}`);
          }
        } catch (error) {
          ctx.check.info(`worker:${pid}:fds`, `unreadable: ${error.code}`);
          continue;
        }
        if (suspicious.length === 0) ctx.check.pass(`worker:${pid}:fds`, "no inherited sockets or state-dir descriptors");
        else ctx.check.fail(`worker:${pid}:fds`, `inherited descriptors: ${suspicious.slice(0, 5).join(", ")}`, { known: "FBX-009" });
      }
    } finally {
      spin.kill();
      await spin.exited;
    }
  } finally {
    child.kill("SIGKILL");
    await sleep(200);
    fs.rmSync(stateDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
