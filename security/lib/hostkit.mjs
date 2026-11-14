// Helpers shared by the host-side tests in security/host.

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export function tempApp(ctx, files) {
  const dir = fs.mkdtempSync(path.join(ctx.baseDir, "app-"));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

// Starts the CLI and keeps its output; `exited` resolves with the exit code (null when killed).
export function startCli(ctx, args, { stateDir } = {}) {
  const full = ["--state-dir", stateDir || ctx.stateDir, ...args];
  const child = spawn(ctx.bins.cli, full, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const run = { child, stdout: "", stderr: "", code: undefined, startedAt: Date.now() };
  child.stdout.on("data", (chunk) => (run.stdout = (run.stdout + chunk).slice(-65536)));
  child.stderr.on("data", (chunk) => (run.stderr = (run.stderr + chunk).slice(-65536)));
  run.exited = new Promise((resolve) => {
    child.once("error", () => resolve((run.code = null)));
    child.once("close", (code) => resolve((run.code = code)));
  });
  run.kill = () => child.kill("SIGKILL");
  return run;
}

// Sends raw bytes to 127.0.0.1:port and collects whatever comes back until the peer closes.
export function rawExchange(port, bytes, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const chunks = [];
    let timedOut = false;
    let timer = null;
    let settled = false;
    const finish = (extra) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ response: Buffer.concat(chunks).toString("latin1"), timedOut, ...extra });
    };
    timer = setTimeout(() => {
      timedOut = true;
      finish({});
    }, timeoutMs);
    socket.on("connect", () => socket.write(bytes));
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("error", (error) => finish({ error: error.message }));
    socket.on("close", () => finish({}));
  });
}

export function statusOf(response) {
  const match = /^HTTP\/1\.[01] (\d{3})/.exec(response);
  return match ? Number(match[1]) : null;
}

export async function waitFor(predicate, { timeoutMs = 15000, stepMs = 100 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return true;
    await sleep(stepMs);
  }
  return false;
}

// Opens a TCP connection and reports whether the peer closes it within `ms`.
export function closedWithin(port, ms, onOpen) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    let timer = null;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    };
    timer = setTimeout(() => finish(false), ms);
    socket.on("connect", () => onOpen && onOpen(socket));
    socket.on("error", () => finish(true));
    socket.on("close", () => finish(true));
    socket.on("end", () => finish(true));
    socket.on("data", () => {});
  });
}

export const tmpDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
