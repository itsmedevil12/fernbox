#!/usr/bin/env node
// FernBox security harness: runs every probe under security/probes inside a real
// sandbox (CLI -> daemon -> worker), runs the host-side tests under security/host,
// and reports which attacks were contained.

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PROBES_DIR = path.join(HERE, "probes");
const HOST_DIR = path.join(HERE, "host");
const EXE = process.platform === "win32" ? ".exe" : "";
const CATEGORY_ORDER = ["sanity", "realm", "fs", "net", "proc", "limits", "host"];
const DEFAULT_DEADLINE_MS = 5000;
const WALL_SLACK_MS = 20000;
const STDOUT_KEEP_BYTES = 8 * 1024 * 1024;
const LATE_PREFIX = "@@KIT ";

// ---------------------------------------------------------------- options

function parseArgs(argv) {
  const opts = {
    filter: [],
    binDir: process.env.FERNBOX_BIN_DIR || null,
    keepState: false,
    json: null,
    color: null,
    verbose: false,
    list: false,
    allowKnown: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === "--filter" || arg === "-f") opts.filter.push(value().toLowerCase());
    else if (arg === "--bin-dir") opts.binDir = value();
    else if (arg === "--keep-state") opts.keepState = true;
    else if (arg === "--json") opts.json = value();
    else if (arg === "--no-color") opts.color = false;
    else if (arg === "--color") opts.color = true;
    else if (arg === "--verbose" || arg === "-v") opts.verbose = true;
    else if (arg === "--list") opts.list = true;
    else if (arg === "--allow-known") opts.allowKnown = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return opts;
}

const HELP = `FernBox security harness

Usage: node security/run.mjs [options]

  -f, --filter <text>   only run probes whose id or title contains <text> (repeatable)
      --bin-dir <dir>   directory holding fernbox, fernbox-daemon and fernbox-worker
                        (default: $FERNBOX_BIN_DIR, target/release, then target/debug)
      --list            list the probes and exit
  -v, --verbose         print every check, not only the ones that did not pass
      --allow-known     findings already tracked in SECURITY.md do not fail the run
      --json <file>     also write the full results as JSON
      --keep-state      keep the temporary state directory for inspection
      --no-color        plain output (also honours NO_COLOR and non-TTY output)
  -h, --help            show this help

Exit status: 0 everything contained, 1 at least one finding, 2 harness errors only.`;

// ---------------------------------------------------------------- colours

let useColor = false;
const CODES = { red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, gray: 90, bold: 1, dim: 2 };

function paint(style, text) {
  if (!useColor) return String(text);
  const open = style.split("+").map((name) => `\x1b[${CODES[name]}m`).join("");
  return `${open}${text}\x1b[0m`;
}

const VERDICT_STYLE = { PASS: "green", VULN: "red+bold", ERROR: "magenta", WARN: "yellow", SKIP: "gray" };
const STATUS_STYLE = { pass: "green", fail: "red+bold", error: "magenta", warn: "yellow", info: "cyan" };
const STATUS_MARK = { pass: "ok  ", fail: "FAIL", error: "ERR ", warn: "warn", info: "info" };

function out(line = "") {
  process.stdout.write(line + "\n");
}

// ---------------------------------------------------------------- ascii table

function renderTable(headers, rows, aligns = []) {
  const text = (cell) => (cell && typeof cell === "object" ? String(cell.text) : String(cell ?? ""));
  const widths = headers.map((header, col) => Math.max(header.length, ...rows.map((row) => text(row[col]).length)));
  const rule = "+" + widths.map((width) => "-".repeat(width + 2)).join("+") + "+";
  const line = (cells, header) =>
    "|" +
    cells
      .map((cell, col) => {
        const raw = text(cell);
        const gap = " ".repeat(widths[col] - raw.length);
        let shown = raw;
        if (header) shown = paint("bold", raw);
        else if (cell && typeof cell === "object" && cell.style) shown = paint(cell.style, raw);
        return aligns[col] === "right" ? ` ${gap}${shown} ` : ` ${shown}${gap} `;
      })
      .join("|") +
    "|";
  return [rule, line(headers, true), rule, ...rows.map((row) => line(row, false)), rule].join("\n");
}

// ---------------------------------------------------------------- discovery

function parseMeta(source) {
  const meta = {};
  for (const line of source.split(/\r?\n/)) {
    const match = /^\/\/\s*@(\w+)\s*(.*)$/.exec(line);
    if (match) {
      const key = match[1];
      const value = match[2].trim();
      if (key === "host") (meta.host ||= []).push(value);
      else meta[key] = value;
    } else if (line.trim() !== "" && !line.startsWith("//")) break;
  }
  return meta;
}

function discoverProbes() {
  const probes = [];
  for (const category of fs.readdirSync(PROBES_DIR).sort()) {
    const dir = path.join(PROBES_DIR, category);
    if (category === "lib" || !fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith(".js")) continue;
      const meta = parseMeta(fs.readFileSync(path.join(dir, file), "utf8"));
      probes.push({
        kind: "probe",
        id: `${category}/${file.replace(/\.js$/, "")}`,
        category,
        entry: `${category}/${file}`,
        title: meta.title || file,
        flags: meta.flags ? meta.flags.split(/\s+/) : [],
        expect: new Set((meta.expect || "checks").split(/[|,\s]+/).filter(Boolean)),
        finding: meta.finding || "",
        scan: meta.scan || "",
        host: meta.host || [],
      });
    }
  }
  return probes;
}

async function discoverHostTests() {
  const tests = [];
  if (!fs.existsSync(HOST_DIR)) return tests;
  for (const file of fs.readdirSync(HOST_DIR).sort()) {
    if (!file.endsWith(".mjs")) continue;
    const module = await import(pathToFileURL(path.join(HOST_DIR, file)).href);
    tests.push({
      kind: "host",
      id: `host/${file.replace(/\.mjs$/, "")}`,
      category: "host",
      title: module.meta?.title || file,
      finding: module.meta?.finding || "",
      skip: module.meta?.skip || null,
      run: module.run,
    });
  }
  return tests;
}

function categoryRank(category) {
  const rank = CATEGORY_ORDER.indexOf(category);
  return rank === -1 ? CATEGORY_ORDER.length : rank;
}

// ---------------------------------------------------------------- environment

function findBinaries(binDir) {
  const candidates = binDir
    ? [path.resolve(binDir)]
    : [path.join(ROOT, "target", "release"), path.join(ROOT, "target", "debug")];
  const names = ["fernbox", "fernbox-daemon", "fernbox-worker"];
  for (const dir of candidates) {
    if (names.every((name) => fs.existsSync(path.join(dir, name + EXE)))) {
      return {
        dir,
        cli: path.join(dir, "fernbox" + EXE),
        daemon: path.join(dir, "fernbox-daemon" + EXE),
        worker: path.join(dir, "fernbox-worker" + EXE),
      };
    }
  }
  throw new Error(
    `could not find fernbox, fernbox-daemon and fernbox-worker in: ${candidates.join(", ")}\n` +
      "build them first (cargo build) or pass --bin-dir",
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomHex = (bytes) => crypto.randomBytes(bytes).toString("hex");

function hashTree(dir) {
  const hashes = {};
  const walk = (current) => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else hashes[path.relative(dir, full)] = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
    }
  };
  walk(dir);
  return hashes;
}

class Daemon {
  constructor(bins, stateDir, extraEnv) {
    this.bins = bins;
    this.stateDir = stateDir;
    this.extraEnv = extraEnv;
    this.child = null;
    this.port = 0;
    this.token = "";
    this.log = "";
    this.restarts = 0;
  }

  async start() {
    const infoPath = path.join(this.stateDir, "daemon.json");
    fs.rmSync(infoPath, { force: true });
    this.child = spawn(this.bins.daemon, ["--state-dir", this.stateDir, "serve", "--port", "0"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, FERNBOX_WORKER: this.bins.worker, ...this.extraEnv },
    });
    const keep = (chunk) => {
      this.log = (this.log + chunk.toString()).slice(-16384);
    };
    this.child.stdout.on("data", keep);
    this.child.stderr.on("data", keep);
    let exited = false;
    this.child.once("exit", () => (exited = true));
    const startedAt = Date.now();
    for (;;) {
      if (exited) throw new Error(`the daemon exited during startup:\n${this.log}`);
      if (fs.existsSync(infoPath)) {
        try {
          const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
          if (info.port && info.token) {
            this.port = info.port;
            this.token = info.token;
            return;
          }
        } catch {}
      }
      if (Date.now() - startedAt > 20000) throw new Error(`the daemon did not write daemon.json in 20s:\n${this.log}`);
      await sleep(50);
    }
  }

  alive() {
    return new Promise((resolve) => {
      if (!this.child || this.child.exitCode !== null) return resolve(false);
      const socket = net.connect({ host: "127.0.0.1", port: this.port });
      const finish = (ok) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(3000, () => finish(false));
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
    });
  }

  async stop() {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;
    await new Promise((resolve) => {
      const force = setTimeout(() => child.kill("SIGKILL"), 5000);
      child.once("exit", () => {
        clearTimeout(force);
        resolve();
      });
      child.kill();
    });
  }

  async restart() {
    this.restarts++;
    await this.stop();
    await this.start();
  }
}

function runProcess(file, args, { wallMs, env } = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(file, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: env || process.env });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let kept = 0;
    let timedOut = false;
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (kept < STDOUT_KEEP_BYTES) {
        stdout.push(chunk);
        kept += chunk.length;
      }
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 256) stderr.push(chunk);
    });
    const timer = wallMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, wallMs)
      : null;
    const finish = (code, spawnError) => {
      if (timer) clearTimeout(timer);
      resolve({
        code,
        timedOut,
        spawnError,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdoutBytes,
        ms: Date.now() - startedAt,
      });
    };
    child.once("error", (error) => finish(null, error));
    child.once("close", (code) => finish(code, null));
  });
}

// ---------------------------------------------------------------- probe evaluation

function deadlineOf(flags) {
  const index = flags.indexOf("--deadline-ms");
  const value = index === -1 ? NaN : Number(flags[index + 1]);
  return Number.isFinite(value) ? value : DEFAULT_DEADLINE_MS;
}

function parseKitReport(stdout) {
  const newline = stdout.indexOf("\n");
  const first = (newline === -1 ? stdout : stdout.slice(0, newline)).trim();
  if (!first.startsWith("completed: ")) return null;
  let value = first.slice("completed: ".length);
  for (let depth = 0; depth < 2 && typeof value === "string"; depth++) {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && value.kit === 1 && Array.isArray(value.checks) ? value : null;
}

function parseLateChecks(stdout) {
  const late = [];
  for (const line of stdout.split("\n")) {
    if (!line.startsWith(LATE_PREFIX)) continue;
    try {
      late.push(JSON.parse(line.slice(LATE_PREFIX.length)));
    } catch {}
  }
  return late;
}

function firstLine(text) {
  return (text.trim().split(/\r?\n/)[0] || "").slice(0, 240);
}

function scanForSecrets(text, secrets, identity) {
  const hits = [];
  for (const secret of secrets) {
    if (text.includes(secret.value)) hits.push({ name: `leak:${secret.name}`, detail: secret.description, known: secret.known });
  }
  if (identity) {
    const lowered = text.toLowerCase();
    for (const item of identity) {
      if (lowered.includes(item.value.toLowerCase())) {
        hits.push({ name: `leak:${item.name}`, detail: `the output contains the host's ${item.description}` });
      }
    }
  }
  return hits;
}

function hostChecksFor(probe, env) {
  const checks = [];
  for (const spec of probe.host) {
    const [kind, ...rest] = spec.split(/\s+/);
    if (kind === "volume-confined") {
      const [name, mount] = rest;
      const file = path.join(env.stateDir, "volumes", `${name}.json`);
      const label = `host:volume-confined:${name}`;
      if (!fs.existsSync(file)) {
        checks.push({ name: label, status: "info", detail: "the volume was not persisted" });
        continue;
      }
      let keys;
      try {
        keys = Object.keys(JSON.parse(fs.readFileSync(file, "utf8")));
      } catch (error) {
        checks.push({ name: label, status: "error", detail: `unreadable volume file: ${error.message}` });
        continue;
      }
      const outside = keys.filter((key) => {
        const normal = path.posix.normalize(key);
        return key !== normal || !(key === mount || key.startsWith(mount + "/"));
      });
      checks.push(
        outside.length
          ? {
              name: label,
              status: "fail",
              detail: `persisted outside ${mount}: ${outside.slice(0, 6).join(", ")}`,
              known: probe.finding || undefined,
            }
          : { name: label, status: "pass", detail: `${keys.length} persisted key(s), all under ${mount}` },
      );
    } else if (kind === "no-file") {
      const target = path.join(env.baseDir, rest[0]);
      checks.push(
        fs.existsSync(target)
          ? { name: `host:no-file:${rest[0]}`, status: "fail", detail: `the sandbox created ${target} on the host` }
          : { name: `host:no-file:${rest[0]}`, status: "pass", detail: "nothing appeared on the host" },
      );
    } else {
      checks.push({ name: `host:${kind}`, status: "error", detail: `unknown @host check: ${spec}` });
    }
  }
  return checks;
}

async function runProbe(probe, env) {
  const deadline = deadlineOf(probe.flags);
  const args = ["--state-dir", env.stateDir, "run", PROBES_DIR, "--entrypoint", probe.entry];
  if (!probe.flags.includes("--deadline-ms")) args.push("--deadline-ms", String(DEFAULT_DEADLINE_MS));
  args.push(...probe.flags);
  for (const [key, value] of Object.entries(env.probeEnv())) args.push("--env", `${key}=${value}`);

  const result = await runProcess(env.bins.cli, args, { wallMs: deadline + WALL_SLACK_MS });
  const checks = [];
  const add = (name, status, detail, known) => checks.push({ name, status, detail, known: known || undefined });
  const expects = (...names) => names.some((name) => probe.expect.has(name));
  const stderrLine = firstLine(result.stderr);
  let daemonDied = false;

  if (result.spawnError) {
    add("run", "error", `could not start the CLI: ${result.spawnError.message}`);
  } else if (result.timedOut) {
    add("run", "fail", `still running ${result.ms}ms after start; the ${deadline}ms deadline did not stop it`);
  } else if (result.code === 0) {
    const report = parseKitReport(result.stdout);
    if (report) {
      checks.push(...report.checks);
      const late = parseLateChecks(result.stdout);
      const settled = new Set(late.map((check) => check.name));
      checks.push(...late);
      for (const name of report.pending || []) {
        if (!settled.has(name)) add(name, "error", "the asynchronous check never reported");
      }
    } else if (expects("contained")) {
      add("run", "pass", "ran to completion without harm");
    } else if (expects("timeout", "oom")) {
      add("run", "fail", `expected termination, but the script completed: ${firstLine(result.stdout)}`);
    } else {
      add("run", "error", `no kit report on stdout: ${firstLine(result.stdout)}`);
    }
  } else if (result.code === 1) {
    if (expects("threw", "contained")) add("run", "pass", stderrLine);
    else add("run", "error", `probe failed: ${stderrLine}`);
  } else if (result.code === 2) {
    if (expects("timeout", "contained")) add("run", "pass", `stopped by the ${deadline}ms deadline after ${result.ms}ms`);
    else add("run", "error", `probe hit the ${deadline}ms deadline`);
  } else if (result.code === 4) {
    if (expects("oom", "contained")) add("run", "pass", "stopped by the heap limit");
    else add("run", "error", "probe hit the heap limit");
  } else {
    add("run", "error", `CLI exit ${result.code}: ${stderrLine}`);
  }

  if (!(await env.daemon.alive())) {
    daemonDied = true;
    add("daemon-alive", "fail", "the daemon stopped answering after this probe");
  }

  const identity = probe.scan === "identity" ? env.identity : null;
  for (const hit of scanForSecrets(result.stdout + result.stderr, env.secrets, identity)) {
    add(hit.name, "fail", hit.detail, hit.known);
  }
  checks.push(...hostChecksFor(probe, env));

  if (daemonDied || result.timedOut) await env.daemon.restart();
  return { checks, ms: result.ms, exitCode: result.code, stdoutBytes: result.stdoutBytes };
}

async function runHostTest(test, env) {
  const checks = [];
  const recorder = {};
  for (const status of ["pass", "fail", "error", "info", "warn"]) {
    recorder[status] = (name, detail = "", extra = {}) => checks.push({ name, status, detail: String(detail).slice(0, 240), ...extra });
  }
  const startedAt = Date.now();
  if (test.skip) {
    const reason = typeof test.skip === "function" ? test.skip() : test.skip;
    if (reason) return { checks, ms: 0, skipped: reason };
  }
  try {
    await test.run({
      check: recorder,
      bins: env.bins,
      daemon: env.daemon,
      stateDir: env.stateDir,
      baseDir: env.baseDir,
      probesDir: PROBES_DIR,
      securityDir: HERE,
      hostCanaryPath: env.hostCanaryPath,
      secrets: env.secrets,
      sleep,
      randomHex,
      cli: (args, options = {}) => runProcess(env.bins.cli, args, { wallMs: 30000, ...options }),
    });
  } catch (error) {
    recorder.error("host-test", `threw: ${error.stack || error.message}`);
  }
  if (!(await env.daemon.alive())) {
    recorder.fail("daemon-alive", "the daemon stopped answering after this test");
    await env.daemon.restart();
  }
  return { checks, ms: Date.now() - startedAt };
}

// ---------------------------------------------------------------- verdicts and reporting

function summarize(item, outcome) {
  const checks = outcome.checks.map((check) => ({ ...check, known: check.known || undefined }));
  const count = (status) => checks.filter((check) => check.status === status).length;
  const fails = checks.filter((check) => check.status === "fail");
  let verdict = "PASS";
  if (outcome.skipped) verdict = "SKIP";
  else if (fails.length) verdict = "VULN";
  else if (count("error")) verdict = "ERROR";
  else if (count("warn")) verdict = "WARN";
  const known = [...new Set(fails.map((check) => check.known).filter(Boolean))];
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    verdict,
    allKnown: fails.length > 0 && fails.every((check) => check.known),
    findings: known,
    newFindings: fails.filter((check) => !check.known).length,
    passed: count("pass"),
    scored: checks.filter((check) => check.status !== "info").length,
    ms: outcome.ms,
    skipped: outcome.skipped || null,
    checks,
  };
}

function logResult(index, total, summary, verbose) {
  const counter = paint("gray", `[${String(index).padStart(String(total).length)}/${total}]`);
  const label = `${summary.id} `.padEnd(34, ".");
  const verdict = paint(VERDICT_STYLE[summary.verdict], summary.verdict.padEnd(5));
  const tally = `${summary.passed}/${summary.scored}`.padStart(7);
  const time = paint("gray", `${summary.ms}ms`.padStart(8));
  const tag = summary.findings.length ? paint("yellow", `  known ${summary.findings.join(",")}`) : "";
  const fresh = summary.newFindings ? paint("red+bold", `  ${summary.newFindings} new`) : "";
  out(`${counter} ${paint("bold", label)} ${verdict} ${tally} ${time}${tag}${fresh}  ${paint("dim", summary.title)}`);
  if (summary.skipped) out(`        ${paint("gray", "skipped: " + summary.skipped)}`);
  for (const check of summary.checks) {
    if (!verbose && (check.status === "pass" || check.status === "info")) continue;
    const mark = paint(STATUS_STYLE[check.status], STATUS_MARK[check.status]);
    const known = check.known && check.status === "fail" ? paint("yellow", ` [${check.known}]`) : "";
    const detail = check.detail ? paint("dim", ` - ${check.detail}`) : "";
    out(`        ${mark} ${check.name}${known}${detail}`);
  }
}

function printReport(summaries, env, elapsedMs) {
  out();
  out(paint("bold+cyan", "RESULTS"));
  const rows = summaries.map((summary, index) => [
    String(index + 1),
    summary.category,
    summary.id.split("/")[1],
    `${summary.passed}/${summary.scored}`,
    `${summary.ms}ms`,
    { text: summary.verdict, style: VERDICT_STYLE[summary.verdict] },
    summary.findings.length ? summary.findings.join(",") + (summary.newFindings ? " +new" : "") : summary.newFindings ? "NEW" : "",
  ]);
  out(renderTable(["#", "Category", "Probe", "Checks", "Time", "Verdict", "Finding"], rows, ["right", "left", "left", "right", "right", "left", "left"]));

  const failed = summaries.flatMap((summary) =>
    summary.checks.filter((check) => check.status === "fail").map((check) => ({ summary, check })),
  );
  if (failed.length) {
    out();
    out(paint("bold+red", "FINDINGS"));
    const clip = (text, max) => (text.length > max ? text.slice(0, max - 3) + "..." : text);
    out(
      renderTable(
        ["Probe", "Check", "Tracked", "Detail"],
        failed.map(({ summary, check }) => [
          summary.id,
          clip(check.name, 44),
          check.known ? { text: check.known, style: "yellow" } : { text: "NEW", style: "red+bold" },
          clip(String(check.detail || "").replace(/\s+/g, " "), 70),
        ]),
      ),
    );
  }

  out();
  out(paint("bold+cyan", "BY CATEGORY"));
  const categories = [...new Set(summaries.map((summary) => summary.category))];
  const tally = (list, verdict) => list.filter((summary) => summary.verdict === verdict).length;
  const categoryRows = categories.map((category) => {
    const list = summaries.filter((summary) => summary.category === category);
    return [
      category,
      String(list.length),
      String(tally(list, "PASS")),
      { text: String(tally(list, "VULN")), style: tally(list, "VULN") ? "red+bold" : "" },
      { text: String(tally(list, "WARN")), style: tally(list, "WARN") ? "yellow" : "" },
      { text: String(tally(list, "ERROR")), style: tally(list, "ERROR") ? "magenta" : "" },
      String(tally(list, "SKIP")),
      `${list.reduce((sum, summary) => sum + summary.passed, 0)}/${list.reduce((sum, summary) => sum + summary.scored, 0)}`,
    ];
  });
  categoryRows.push([
    "TOTAL",
    String(summaries.length),
    String(tally(summaries, "PASS")),
    { text: String(tally(summaries, "VULN")), style: tally(summaries, "VULN") ? "red+bold" : "" },
    { text: String(tally(summaries, "WARN")), style: tally(summaries, "WARN") ? "yellow" : "" },
    { text: String(tally(summaries, "ERROR")), style: tally(summaries, "ERROR") ? "magenta" : "" },
    String(tally(summaries, "SKIP")),
    `${summaries.reduce((sum, summary) => sum + summary.passed, 0)}/${summaries.reduce((sum, summary) => sum + summary.scored, 0)}`,
  ]);
  out(
    renderTable(["Category", "Probes", "Pass", "Vuln", "Warn", "Error", "Skip", "Checks"], categoryRows, [
      "left", "right", "right", "right", "right", "right", "right", "right",
    ]),
  );

  const vulns = summaries.filter((summary) => summary.verdict === "VULN");
  const fresh = vulns.filter((summary) => !summary.allKnown).length;
  out();
  const restarts = env.daemon.restarts ? `, ${env.daemon.restarts} daemon restart(s)` : "";
  out(paint("gray", `${summaries.length} probes in ${(elapsedMs / 1000).toFixed(1)}s against ${env.bins.dir}${restarts}`));
  if (!vulns.length && !tally(summaries, "ERROR")) out(paint("green+bold", "Every attack was contained."));
  if (vulns.length) {
    out(
      paint("red+bold", `${vulns.length} probe(s) broke containment`) +
        ` (${fresh} with findings not tracked in SECURITY.md, ${vulns.length - fresh} already tracked).`,
    );
  }
  if (tally(summaries, "ERROR")) out(paint("magenta", `${tally(summaries, "ERROR")} probe(s) could not be evaluated.`));

  out();
  out(renderRatingBanner(computeRating(summaries)));
}

// score = 5 * (passed / scored) - (0.6 * vuln probes + 0.25 * error probes + 0.1 * warn probes), clamped to 0..5
function computeRating(summaries) {
  const live = summaries.filter((summary) => summary.verdict !== "SKIP");
  const scored = live.reduce((sum, summary) => sum + summary.scored, 0);
  const passed = live.reduce((sum, summary) => sum + summary.passed, 0);
  const count = (verdict) => live.filter((summary) => summary.verdict === verdict).length;
  const vuln = count("VULN");
  const error = count("ERROR");
  const warn = count("WARN");
  const ratio = scored ? passed / scored : 0;
  const raw = 5 * ratio - (0.6 * vuln + 0.25 * error + 0.1 * warn);
  const score = Math.max(0, Math.min(5, Math.round(raw * 10) / 10));
  let grade = "CRITICAL";
  if (score >= 4.5) grade = "HARDENED";
  else if (score >= 3.5) grade = "SOLID";
  else if (score >= 2.5) grade = "WEAK";
  else if (score >= 1.5) grade = "POOR";
  const style = score >= 4.5 ? "green+bold" : score >= 3.5 ? "green" : score >= 2.5 ? "yellow" : "red+bold";
  return { score, grade, style, ratio, vuln, error, warn, probes: live.length, scored, passed };
}

function renderRatingBanner(rating) {
  const width = 66;
  const full = Math.floor(rating.score + 0.5);
  const stars = "[" + "*".repeat(full) + "-".repeat(5 - full) + "]";
  const rule = "+" + "=".repeat(width) + "+";
  const row = (text, style) => {
    const body = text.length > width - 2 ? text.slice(0, width - 2) : text;
    const shown = style ? paint(style, body) : body;
    return "| " + shown + " ".repeat(width - 1 - body.length) + "|";
  };
  const title = "FERNBOX SECURITY RATING";
  return [
    rule,
    row(" ".repeat(Math.floor((width - 2 - title.length) / 2)) + title, "bold+cyan"),
    rule,
    row(`  ${stars}   ${rating.score.toFixed(1)} / 5.0   ${rating.grade}`, rating.style),
    row(""),
    row(`  checks passed : ${rating.passed}/${rating.scored} (${(rating.ratio * 100).toFixed(1)}%)`),
    row(`  probes        : ${rating.probes}  (vuln ${rating.vuln}, error ${rating.error}, warn ${rating.warn})`),
    row("  formula       : 5*(passed/scored) - 0.6*vuln - 0.25*err - 0.1*warn"),
    row("  grades        : >=4.5 HARDENED  >=3.5 SOLID  >=2.5 WEAK  >=1.5 POOR"),
    rule,
  ].join("\n");
}

// ---------------------------------------------------------------- main

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${HELP}\n`);
    return 3;
  }
  useColor = opts.color ?? (Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
  if (opts.help) {
    out(HELP);
    return 0;
  }

  let items = [...discoverProbes(), ...(await discoverHostTests())].sort(
    (a, b) => categoryRank(a.category) - categoryRank(b.category) || a.id.localeCompare(b.id),
  );
  if (opts.filter.length) {
    items = items.filter((item) => opts.filter.some((text) => item.id.toLowerCase().includes(text) || item.title.toLowerCase().includes(text)));
  }
  if (opts.list) {
    out(renderTable(["Id", "Title", "Expect", "Finding"], items.map((item) => [item.id, item.title, item.expect ? [...item.expect].join("|") : "host", item.finding])));
    return 0;
  }
  if (!items.length) {
    process.stderr.write("no probes match the filter\n");
    return 3;
  }

  const bins = findBinaries(opts.binDir);
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "fernbox-sec-"));
  const stateDir = path.join(baseDir, "state");
  fs.mkdirSync(stateDir);
  const hostCanaryPath = path.join(baseDir, "host-canary.txt");
  const fileCanary = `FILE_CANARY_${randomHex(12)}`;
  const envCanary = `ENV_CANARY_${randomHex(12)}`;
  fs.writeFileSync(hostCanaryPath, fileCanary + "\n");

  const daemon = new Daemon(bins, stateDir, { SEC_DAEMON_ENV_CANARY: envCanary });
  const username = os.userInfo().username;
  const env = {
    bins,
    baseDir,
    stateDir,
    hostCanaryPath,
    daemon,
    secrets: [],
    identity: [
      { name: "host-username", value: username, description: "user name" },
      { name: "host-hostname", value: os.hostname(), description: "host name" },
    ].filter((item) => item.value.length >= 4),
    probeEnv: () => ({
      SEC_HOST_CANARY_PATH: hostCanaryPath,
      SEC_HOST_DIR: baseDir,
      SEC_DAEMON_JSON: path.join(stateDir, "daemon.json"),
      SEC_DAEMON_PORT: String(daemon.port),
    }),
  };
  const refreshSecrets = () => {
    env.secrets = [
      { name: "daemon-token", value: daemon.token, description: "the output contains the daemon's control token" },
      { name: "host-file", value: fileCanary, description: "the output contains the contents of a host file outside the sandbox" },
      { name: "daemon-env", value: envCanary, description: "the output contains a variable from the daemon's environment", known: "FBX-009" },
    ];
  };

  let interrupted = false;
  const cleanup = async () => {
    await daemon.stop().catch(() => {});
    if (opts.keepState) out(paint("gray", `state kept in ${baseDir}`));
    else {
      try {
        fs.rmSync(baseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      } catch {}
    }
  };
  process.once("SIGINT", () => {
    interrupted = true;
  });

  const summaries = [];
  const startedAt = Date.now();
  try {
    out(paint("bold+cyan", "FernBox security harness"));
    out(paint("gray", `binaries: ${bins.dir}`));
    await daemon.start();
    refreshSecrets();
    out(paint("gray", `daemon:   127.0.0.1:${daemon.port} (pid ${daemon.child.pid}), state ${stateDir}`));
    out();
    const before = hashTree(PROBES_DIR);

    for (const [index, item] of items.entries()) {
      if (interrupted) break;
      const outcome = item.kind === "probe" ? await runProbe(item, env) : await runHostTest(item, env);
      refreshSecrets();
      const summary = summarize(item, outcome);
      summaries.push(summary);
      logResult(index + 1, items.length, summary, opts.verbose);
    }

    const after = hashTree(PROBES_DIR);
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((file) => before[file] !== after[file]);
    const integrity = summarize(
      { id: "host/source-integrity", category: "host", title: "Probe sources on the host are untouched" },
      {
        ms: 0,
        checks: [
          changed.length
            ? { name: "sources-unmodified", status: "fail", detail: `changed on the host: ${changed.slice(0, 6).join(", ")}` }
            : { name: "sources-unmodified", status: "pass", detail: `${Object.keys(after).length} files identical` },
        ],
      },
    );
    summaries.push(integrity);
    logResult(items.length, items.length, integrity, opts.verbose);

    printReport(summaries, env, Date.now() - startedAt);
    if (opts.json) {
      fs.writeFileSync(path.resolve(opts.json), JSON.stringify({ binaries: bins.dir, elapsedMs: Date.now() - startedAt, rating: computeRating(summaries), results: summaries }, null, 2));
      out(paint("gray", `wrote ${path.resolve(opts.json)}`));
    }
  } finally {
    await cleanup();
  }

  if (interrupted) return 130;
  const vulns = summaries.filter((summary) => summary.verdict === "VULN");
  const blocking = opts.allowKnown ? vulns.filter((summary) => !summary.allKnown) : vulns;
  if (blocking.length) return 1;
  if (summaries.some((summary) => summary.verdict === "ERROR")) return 2;
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`harness error: ${error.stack || error.message}\n`);
    process.exitCode = 2;
  },
);
