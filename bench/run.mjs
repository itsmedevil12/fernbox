#!/usr/bin/env node
// FernBox's HTTP benchmark: one service in Express, Koa, and Fastify, each
// measured on plain Node and inside FernBox, with the same client and the same
// load.
//
// Every request opens a new TCP connection because the gate does not keep one
// alive; the Node baseline disables keep-alive too, so the comparison is
// like-for-like. Throughput, latency percentiles, error rate, RSS, and CPU come
// out as JSON and as a Markdown table.
//
//   node bench/run.mjs
//   node bench/run.mjs --binary target/release/fernbox.exe --duration 10
//   node bench/run.mjs --targets express --no-baseline
//
// The benchmark starts its own daemon in a throwaway state directory and stops
// it on the way out, so a developer's own daemon is never touched (its state
// directory is different even if a process happens to share the name).
//
// CPU and RSS are sampled from the sandbox's process tree (the daemon and the
// worker of this benchmark), or from the Node process for a baseline. Matching
// the daemon and worker by name is deliberate: the worker is spawned per run,
// so its pid is not known up front. On a machine running another FernBox at the
// same time, that other process's usage is included; a benchmark machine should
// be otherwise idle.

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const FRAMEWORKS = [
  { name: "express", entry: "express.js" },
  { name: "koa", entry: "koa.js" },
  { name: "fastify", entry: "fastify.js" },
];

const HELP = `FernBox HTTP benchmark

Usage: node bench/run.mjs [options]

Options:
  --binary PATH       fernbox CLI (default: target/release or target/debug)
  --daemon PATH       fernbox-daemon (default: next to the CLI)
  --app-dir DIR       app folder to run (default: bench/apps)
  --targets LIST      comma-separated: ${FRAMEWORKS.map((f) => f.name).join(", ")}
  --no-baseline       skip the plain Node runs
  --warmup SECONDS    load before measuring (default: 2)
  --duration SECONDS  measurement window (default: 5)
  --concurrency N     concurrent client connections (default: 32)
  --json FILE         JSON report (default: bench-results/latest.json)
  --markdown FILE     Markdown report (default: bench-results/latest.md)
  --help              this text
`;

function parseArgs(argv) {
  const opts = {
    binary: null,
    daemon: null,
    appDir: path.join(HERE, "apps"),
    targets: FRAMEWORKS.map((framework) => framework.name),
    baseline: true,
    warmup: 2,
    duration: 5,
    concurrency: 32,
    json: path.join(ROOT, "bench-results", "latest.json"),
    markdown: path.join(ROOT, "bench-results", "latest.md"),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };

    switch (arg) {
      case "--binary":
        opts.binary = value();
        break;
      case "--daemon":
        opts.daemon = value();
        break;
      case "--app-dir":
        opts.appDir = value();
        break;
      case "--targets":
        opts.targets = value()
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean);
        break;
      case "--no-baseline":
        opts.baseline = false;
        break;
      case "--warmup":
        opts.warmup = Number(value());
        break;
      case "--duration":
        opts.duration = Number(value());
        break;
      case "--concurrency":
        opts.concurrency = Number(value());
        break;
      case "--json":
        opts.json = value();
        break;
      case "--markdown":
        opts.markdown = value();
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        throw new Error(`unknown option ${arg}`);
    }
  }

  if (!opts.help) {
    if (!(opts.warmup >= 0)) throw new Error("--warmup must be zero or more seconds");
    if (!(opts.duration > 0)) throw new Error("--duration must be a positive number of seconds");
    if (!(opts.concurrency >= 1)) throw new Error("--concurrency must be at least 1");
    const known = new Set(FRAMEWORKS.map((framework) => framework.name));
    for (const target of opts.targets) {
      if (!known.has(target)) throw new Error(`unknown target ${target}`);
    }
    if (opts.targets.length === 0) throw new Error("no targets selected");
  }

  opts.appDir = path.resolve(opts.appDir);
  opts.json = path.resolve(opts.json);
  opts.markdown = path.resolve(opts.markdown);
  return opts;
}

function resolveBinaries(opts) {
  const suffix = process.platform === "win32" ? ".exe" : "";
  let cli = opts.binary;
  if (!cli) {
    cli = [`target/release/fernbox${suffix}`, `target/debug/fernbox${suffix}`]
      .map((candidate) => path.join(ROOT, candidate))
      .find((candidate) => fs.existsSync(candidate));
    if (!cli) {
      throw new Error("no fernbox binary found; run `cargo build` or pass --binary");
    }
  }
  cli = path.resolve(cli);
  if (!fs.existsSync(cli)) throw new Error(`no CLI at ${cli}`);

  const daemon = path.resolve(
    opts.daemon ?? path.join(path.dirname(cli), `fernbox-daemon${suffix}`),
  );
  const worker = path.join(path.dirname(daemon), `fernbox-worker${suffix}`);
  if (!fs.existsSync(daemon)) throw new Error(`no daemon at ${daemon}`);
  if (!fs.existsSync(worker)) throw new Error(`no worker at ${worker}`);
  return { cli, daemon, worker };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function tail(text, limit = 4000) {
  const trimmed = text.trim();
  return trimmed.length <= limit ? trimmed : trimmed.slice(trimmed.length - limit);
}

function capture(child) {
  const chunks = [];
  const keep = (chunk) => {
    chunks.push(chunk);
    if (chunks.length > 400) chunks.shift();
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);
  return () => Buffer.concat(chunks).toString();
}

function waitExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return resolve(child.exitCode ?? (child.signalCode ? 1 : 0));
    }
    const timer = setTimeout(() => resolve(null), timeoutMs);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function requestOnce({ port, urlPath = "/", method = "GET", timeoutMs = 5000 }) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: urlPath,
        method,
        agent: false,
        headers: { Connection: "close" },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }),
        );
        response.on("error", reject);
      },
    );
    request.setTimeout(timeoutMs, () =>
      request.destroy(new Error(`request timed out after ${timeoutMs}ms`)),
    );
    request.on("error", reject);
    request.end();
  });
}

async function isHealthy(port) {
  try {
    const response = await requestOnce({ port, urlPath: "/health", timeoutMs: 1000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function waitReady(child, port, output) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `server exited before answering /health (${child.exitCode ?? child.signalCode})\n${tail(output())}`,
      );
    }
    if (await isHealthy(port)) return;
    await sleep(200);
  }
  throw new Error(`server did not answer /health within 60s\n${tail(output())}`);
}

/// Sample the process tree every 500ms. Windows uses one long-lived PowerShell
/// that prints `name|pid|cpu-seconds|working-set` per process; Linux reads
/// /proc directly. Both give cumulative CPU seconds, so the summary works on
/// deltas and never has to know a sampling period's exact jitter.
function startSampler({ names = [], pids = [] }) {
  const samples = [];
  let stop = async () => {};

  if (process.platform === "win32") {
    const filter = names.length
      ? `Get-Process -Name ${names.map((name) => `'${name}'`).join(",")} -ErrorAction SilentlyContinue`
      : `Get-Process -Id ${pids.join(",")} -ErrorAction SilentlyContinue`;
    const script = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      "while ($true) {",
      `  ${filter} | ForEach-Object { '{0}|{1}|{2}|{3}' -f $_.ProcessName, $_.Id, $_.CPU, $_.WorkingSet64 }`,
      "  '---'",
      "  [Console]::Out.Flush()",
      "  Start-Sleep -Milliseconds 500",
      "}",
    ].join("\r\n");
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const powershell = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
    );

    let buffered = "";
    let current = [];
    powershell.stdout.on("data", (chunk) => {
      buffered += chunk.toString();
      let newline;
      while ((newline = buffered.indexOf("\n")) !== -1) {
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        if (!line) continue;
        if (line === "---") {
          if (current.length > 0) samples.push({ t: Date.now(), procs: current });
          current = [];
          continue;
        }
        const [name, pid, cpu, rss] = line.split("|");
        current.push({
          name,
          pid: Number(pid),
          cpuSeconds: Number(cpu) || 0,
          rssBytes: Number(rss) || 0,
        });
      }
    });

    stop = async () => {
      powershell.kill();
      await new Promise((resolve) => {
        if (powershell.exitCode !== null) return resolve();
        const timer = setTimeout(resolve, 2000);
        powershell.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    };
  } else if (process.platform === "linux") {
    const wanted = new Set(pids);
    const timer = setInterval(() => {
      const procs = [];
      for (const entry of fs.readdirSync("/proc")) {
        if (!/^\d+$/.test(entry)) continue;
        const pid = Number(entry);
        let name;
        try {
          name = fs.readFileSync(`/proc/${entry}/comm`, "utf8").trim();
        } catch {
          continue;
        }
        if (!wanted.has(pid) && !names.includes(name)) continue;
        try {
          const stat = fs.readFileSync(`/proc/${entry}/stat`, "utf8");
          const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
          const ticks = Number(fields[11]) + Number(fields[12]);
          const status = fs.readFileSync(`/proc/${entry}/status`, "utf8");
          const rss = Number((status.match(/VmRSS:\s+(\d+)/) || [])[1] || 0) * 1024;
          procs.push({ name, pid, cpuSeconds: ticks / 100, rssBytes: rss });
        } catch {
          // The process exited between listing and reading; nothing to record.
        }
      }
      samples.push({ t: Date.now(), procs });
    }, 500);
    stop = async () => clearInterval(timer);
  }

  return { samples, stop };
}

function summarizeSamples(samples, cores) {
  if (samples.length < 2) return null;

  let cpuSeconds = 0;
  let coresPeak = 0;
  for (let i = 1; i < samples.length; i++) {
    const before = samples[i - 1];
    const after = samples[i];
    const elapsed = (after.t - before.t) / 1000;
    if (elapsed <= 0) continue;
    const previousCpu = new Map(before.procs.map((proc) => [proc.pid, proc.cpuSeconds]));
    let delta = 0;
    for (const proc of after.procs) {
      const was = previousCpu.get(proc.pid);
      if (was !== undefined) delta += Math.max(0, proc.cpuSeconds - was);
    }
    cpuSeconds += delta;
    coresPeak = Math.max(coresPeak, delta / elapsed);
  }

  const elapsed = (samples[samples.length - 1].t - samples[0].t) / 1000;
  const coresAvg = elapsed > 0 ? cpuSeconds / elapsed : 0;

  let rssPeak = 0;
  let rssSum = 0;
  for (const sample of samples) {
    const total = sample.procs.reduce((sum, proc) => sum + proc.rssBytes, 0);
    rssPeak = Math.max(rssPeak, total);
    rssSum += total;
  }

  return {
    coresAvg: round(coresAvg, 2),
    coresPeak: round(coresPeak, 2),
    machinePct: cores > 0 ? round((coresAvg / cores) * 100, 1) : null,
    rssPeakMB: round(rssPeak / 1048576, 1),
    rssAvgMB: round(rssSum / samples.length / 1048576, 1),
    samples: samples.length,
  };
}

function percentile(sorted, value) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((value / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function runLoad(port, durationMs, concurrency) {
  const started = performance.now();
  const deadline = started + durationMs;
  const stats = { requests: 0, errors: 0, latencies: [] };

  const workers = [];
  for (let index = 0; index < concurrency; index++) {
    workers.push(
      (async () => {
        while (performance.now() < deadline) {
          const at = performance.now();
          try {
            const response = await requestOnce({ port, urlPath: "/json" });
            if (response.status !== 200) throw new Error(`status ${response.status}`);
            const parsed = JSON.parse(response.body);
            if (parsed.message !== "hello world") throw new Error("unexpected body");
            stats.requests++;
            stats.latencies.push(performance.now() - at);
          } catch {
            stats.errors++;
          }
        }
      })(),
    );
  }
  await Promise.all(workers);

  const elapsedMs = performance.now() - started;
  const sorted = stats.latencies.sort((a, b) => a - b);
  const total = stats.requests + stats.errors;
  return {
    attempted: total,
    requests: stats.requests,
    errors: stats.errors,
    errorRatePct: total > 0 ? round((stats.errors / total) * 100, 2) : null,
    rps: elapsedMs > 0 ? round(stats.requests / (elapsedMs / 1000), 1) : 0,
    elapsedMs: round(elapsedMs, 0),
    latencyMs: {
      avg: stats.latencies.length
        ? round(stats.latencies.reduce((sum, value) => sum + value, 0) / stats.latencies.length, 2)
        : null,
      p50: round(percentile(sorted, 50), 2),
      p95: round(percentile(sorted, 95), 2),
      p99: round(percentile(sorted, 99), 2),
      max: stats.latencies.length ? round(sorted[sorted.length - 1], 2) : null,
    },
  };
}

async function startDaemon(daemonPath, stateDir) {
  const child = spawn(daemonPath, ["--state-dir", stateDir, "serve", "--port", "0"], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const output = capture(child);
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `daemon exited before it was ready (${child.exitCode ?? child.signalCode})\n${tail(output())}`,
      );
    }
    if (fs.existsSync(path.join(stateDir, "daemon.json"))) return { child, output };
    await sleep(100);
  }
  child.kill();
  throw new Error(`daemon did not write daemon.json within 20s\n${tail(output())}`);
}

async function stopDaemon(daemon) {
  if (!daemon || daemon.child.exitCode !== null || daemon.child.signalCode !== null) return;
  daemon.child.kill();
  const exited = await waitExit(daemon.child, 5000);
  if (exited === null) daemon.child.kill("SIGKILL");
}

async function runCase({ framework, runtime, binaries, stateDir, appDir, opts }) {
  const port = await freePort();
  // The app closes itself this long after it starts listening: roughly the
  // measurement window plus a margin for the harness to finish. The sandbox has
  // no signals, so a timer is the one reliable way to end a serving run.
  const closeAfterMs = Math.round((opts.warmup + opts.duration + 5) * 1000);
  const result = {
    framework: framework.name,
    runtime,
    ok: false,
    error: null,
    port,
    startedAt: new Date().toISOString(),
    usage: null,
  };

  let child;
  let output;
  let sampler = null;

  try {
    if (runtime === "fernbox") {
      const args = [
        "--state-dir",
        stateDir,
        "run",
        appDir,
        "--entrypoint",
        framework.entry,
        "--publish",
        String(port),
        "--deadline-ms",
        "15000",
        "--max-life-ms",
        String(closeAfterMs + 60_000),
        "--env",
        `PORT=${port}`,
        "--env",
        `AUTO_CLOSE_MS=${closeAfterMs}`,
      ];
      child = spawn(binaries.cli, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        cwd: ROOT,
      });
    } else {
      child = spawn(process.execPath, [path.join(appDir, framework.entry)], {
        cwd: appDir,
        env: {
          ...process.env,
          PORT: String(port),
          AUTO_CLOSE_MS: String(closeAfterMs),
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    }
    output = capture(child);

    await waitReady(child, port, output);
    sampler = startSampler(
      runtime === "fernbox"
        ? { names: ["fernbox-daemon", "fernbox-worker"] }
        : { pids: [child.pid] },
    );
    // The first sample lands before load starts, so the CPU delta begins at
    // idle rather than crediting startup work to the measurement.
    await sleep(600);

    await runLoad(port, opts.warmup * 1000, opts.concurrency);
    const measured = await runLoad(port, opts.duration * 1000, opts.concurrency);
    result.usage = summarizeSamples(sampler.samples, os.cpus().length);
    await sampler.stop();
    sampler = null;

    Object.assign(result, measured);
    if (measured.requests === 0) {
      throw new Error(
        `no successful responses (${measured.errors} errors)\n${tail(output())}`,
      );
    }

    const exitCode = await waitExit(child, 30_000);
    if (exitCode === null) {
      child.kill();
      throw new Error("server did not close after the measurement window");
    }
    result.exitCode = exitCode;
    if (exitCode !== 0) {
      throw new Error(`server exited with code ${exitCode}\n${tail(output())}`);
    }
    result.ok = true;
  } catch (err) {
    result.error = err.message;
  } finally {
    if (sampler) await sampler.stop();
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill();
      await waitExit(child, 5000);
    }
  }

  return result;
}

function buildReport({ opts, binaries, results }) {
  return {
    generatedAt: new Date().toISOString(),
    environment: {
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      cpu: os.cpus()[0]?.model ?? "unknown",
      cores: os.cpus().length,
      memoryGB: round(os.totalmem() / 1073741824, 1),
      node: process.version,
      binary: binaries?.cli ?? null,
    },
    config: {
      endpoint: "GET /json",
      warmupSeconds: opts.warmup,
      durationSeconds: opts.duration,
      concurrency: opts.concurrency,
      baseline: opts.baseline,
      targets: opts.targets,
    },
    results,
  };
}

function renderMarkdown(report) {
  const environment = report.environment;
  const config = report.config;
  const lines = [];

  lines.push("## FernBox HTTP benchmark");
  lines.push("");
  lines.push(
    `- Host: ${environment.platform} ${environment.release} ${environment.arch}, ` +
      `${environment.cpu}, ${environment.cores} logical cores, ${environment.memoryGB} GB RAM`,
  );
  lines.push(`- Node: ${environment.node}`);
  lines.push(`- Binary: \`${environment.binary ?? "n/a"}\``);
  lines.push(
    `- Workload: ${config.endpoint}, a new TCP connection per request, ` +
      `warmup ${config.warmupSeconds}s, measure ${config.durationSeconds}s, ` +
      `concurrency ${config.concurrency}`,
  );
  lines.push("");
  lines.push(
    "| Framework | Runtime | RPS | p50 ms | p95 ms | p99 ms | errors | RSS peak MB | CPU cores | CPU % of host |",
  );
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const result of report.results) {
    if (!result.ok) {
      lines.push(`| ${result.framework} | ${result.runtime} | failed | - | - | - | - | - | - | - |`);
      continue;
    }
    lines.push(
      `| ${result.framework} | ${result.runtime} | ${result.rps} | ${result.latencyMs.p50} | ` +
        `${result.latencyMs.p95} | ${result.latencyMs.p99} | ${result.errors} | ` +
        `${result.usage?.rssPeakMB ?? "-"} | ${result.usage?.coresAvg ?? "-"} | ` +
        `${result.usage?.machinePct ?? "-"} |`,
    );
  }

  const byKey = new Map(
    report.results
      .filter((result) => result.ok)
      .map((result) => [`${result.framework}/${result.runtime}`, result]),
  );
  const compared = FRAMEWORKS.map((framework) => {
    const node = byKey.get(`${framework.name}/node`);
    const fernbox = byKey.get(`${framework.name}/fernbox`);
    return node && fernbox ? { framework: framework.name, node, fernbox } : null;
  }).filter(Boolean);

  if (compared.length > 0) {
    lines.push("");
    lines.push("### FernBox against plain Node");
    lines.push("");
    lines.push("| Framework | Node RPS | FernBox RPS | FernBox / Node | Node RSS MB | FernBox RSS MB |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
    for (const { framework, node, fernbox } of compared) {
      const ratio = node.rps > 0 ? `${round((fernbox.rps / node.rps) * 100, 1)}%` : "-";
      lines.push(
        `| ${framework} | ${node.rps} | ${fernbox.rps} | ${ratio} | ` +
          `${node.usage?.rssPeakMB ?? "-"} | ${fernbox.usage?.rssPeakMB ?? "-"} |`,
      );
    }
  }

  const failed = report.results.filter((result) => !result.ok);
  if (failed.length > 0) {
    lines.push("");
    lines.push("### Failures");
    lines.push("");
    for (const result of failed) {
      lines.push(`- ${result.framework}/${result.runtime}: ${result.error.split("\n")[0]}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function writeReports(opts, report) {
  fs.mkdirSync(path.dirname(opts.json), { recursive: true });
  fs.mkdirSync(path.dirname(opts.markdown), { recursive: true });
  fs.writeFileSync(opts.json, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(opts.markdown, renderMarkdown(report));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }

  if (!fs.existsSync(path.join(opts.appDir, "node_modules"))) {
    throw new Error(
      `no node_modules in ${opts.appDir}; run \`npm install\` there before benchmarking`,
    );
  }

  const binaries = resolveBinaries(opts);
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "fernbox-bench-"));
  const results = [];
  const report = () => buildReport({ opts, binaries, results });
  let daemon = null;

  try {
    console.log(`daemon: ${binaries.daemon}`);
    console.log(`state:  ${stateDir}`);
    daemon = await startDaemon(binaries.daemon, stateDir);

    const selected = FRAMEWORKS.filter((framework) => opts.targets.includes(framework.name));
    for (const framework of selected) {
      const runtimes = opts.baseline ? ["node", "fernbox"] : ["fernbox"];
      for (const runtime of runtimes) {
        console.log(`benchmarking ${framework.name} on ${runtime}...`);
        const result = await runCase({
          framework,
          runtime,
          binaries,
          stateDir,
          appDir: opts.appDir,
          opts,
        });
        results.push(result);
        writeReports(opts, report());
        if (result.ok) {
          console.log(
            `  ${result.rps} rps, p95 ${result.latencyMs.p95} ms, ` +
              `RSS ${result.usage?.rssPeakMB ?? "-"} MB, ` +
              `CPU ${result.usage?.coresAvg ?? "-"} cores`,
          );
        } else {
          console.error(`  failed: ${result.error}`);
        }
      }
    }
  } catch (err) {
    results.push({ framework: "setup", runtime: "-", ok: false, error: err.message });
    console.error(`benchmark failed: ${err.message}`);
  } finally {
    await stopDaemon(daemon);
    try {
      fs.rmSync(stateDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // A state directory left behind is harmless; failing the run over it is not.
    }
  }

  writeReports(opts, report());
  process.stdout.write(`\n${renderMarkdown(report())}`);
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
