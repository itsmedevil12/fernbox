import net from "node:net";
import { closedWithin, freePort, rawExchange, sleep, startCli, statusOf, tempApp, waitFor } from "../lib/hostkit.mjs";

export const meta = {
  title: "Published-port gate: framing smuggling, CRLF header injection, slowloris, deadline renewal",
  finding: "FBX-008",
};

const KNOWN = { known: "FBX-008" };

const APP = `
const http = require("http");
const port = Number(process.env.PORT);
http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/hdr") {
    const value = decodeURIComponent(req.url.split("?v=")[1] || "");
    try {
      res.setHeader("X-Echo", value);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end("setHeader refused: " + error.message);
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  if (url === "/echo") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ echo: req.body, headers: req.headers }));
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("hello");
}).listen(port, () => console.log("ready " + port));
`;

const get = (path, extra = "") => `GET ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n${extra}\r\n`;

async function startApp(ctx, port, deadlineMs, maxLifeMs) {
  const dir = tempApp(ctx, { "main.js": APP });
  const run = startCli(ctx, [
    "run", dir, "--entrypoint", "main.js",
    "--publish", String(port), "--env", `PORT=${port}`,
    "--deadline-ms", String(deadlineMs), "--max-life-ms", String(maxLifeMs),
  ]);
  const ready = await waitFor(async () => (statusOf((await rawExchange(port, get("/"), { timeoutMs: 1500 })).response) ?? 0) === 200, {
    timeoutMs: 20000,
    stepMs: 250,
  });
  return { run, ready };
}

export async function run(ctx) {
  // ---- framing and injection
  {
    const port = await freePort();
    const { run: cli, ready } = await startApp(ctx, port, 30000, 60000);
    if (!ready) {
      ctx.check.error("gate:start", `app never became reachable through the gate; stderr: ${cli.stderr.slice(-200)}`);
      cli.kill();
      return;
    }
    try {
      const dup = await rawExchange(
        port,
        `POST /echo HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nContent-Length: 3\r\nContent-Length: 10\r\n\r\nabcdefghij`,
      );
      const dupStatus = statusOf(dup.response);
      if (dupStatus !== null && dupStatus >= 400 && dupStatus < 500) ctx.check.pass("gate:duplicate-content-length", `refused with ${dupStatus}`);
      else ctx.check.fail("gate:duplicate-content-length", `conflicting Content-Length headers got status ${dupStatus}`, KNOWN);

      const both = await rawExchange(
        port,
        `POST /echo HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nContent-Length: 4\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n`,
      );
      const bothStatus = statusOf(both.response);
      if (bothStatus !== null && bothStatus >= 400) ctx.check.pass("gate:cl-plus-te", `refused with ${bothStatus}`);
      else ctx.check.fail("gate:cl-plus-te", `Content-Length plus Transfer-Encoding got status ${bothStatus}`, KNOWN);

      const crlf = await rawExchange(port, get("/hdr?v=a%0d%0aX-Injected:%20yes"));
      const headEnd = crlf.response.indexOf("\r\n\r\n");
      const head = headEnd === -1 ? crlf.response : crlf.response.slice(0, headEnd);
      if (/^x-injected:/im.test(head)) ctx.check.fail("gate:crlf-response-header", "an attacker-controlled X-Injected header appeared in the response", KNOWN);
      else ctx.check.pass("gate:crlf-response-header", "no injected response header");

      const rawLf = await rawExchange(port, get("/hdr?v=a%0aX-Injected2:%20yes"));
      const lfEnd = rawLf.response.indexOf("\r\n\r\n");
      const lfHead = lfEnd === -1 ? rawLf.response : rawLf.response.slice(0, lfEnd);
      if (/^x-injected2:/im.test(lfHead)) ctx.check.fail("gate:lf-response-header", "a bare-LF injected header appeared in the response", KNOWN);
      else ctx.check.pass("gate:lf-response-header", "no bare-LF injected header");

      const smuggled = await rawExchange(
        port,
        `GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 0\r\nX-Pad: a\r\n b\r\n\r\n`,
      );
      const smuggledStatus = statusOf(smuggled.response);
      if (smuggledStatus === null || smuggledStatus < 500) ctx.check.pass("gate:obs-fold", `obsolete line folding answered ${smuggledStatus}`);
      else ctx.check.fail("gate:obs-fold", `obsolete line folding got status ${smuggledStatus}`, KNOWN);
    } finally {
      cli.kill();
      await cli.exited;
    }
  }

  // ---- slowloris and deadline renewal
  {
    const port = await freePort();
    const { run: cli, ready } = await startApp(ctx, port, 4000, 120000);
    if (!ready) {
      ctx.check.error("gate:slowloris-start", "app never became reachable through the gate");
      cli.kill();
      return;
    }
    const held = [];
    try {
      const idleClosed = closedWithin(port, 12000, null);

      const startedAt = Date.now();
      let exitedEarly = false;
      cli.exited.then(() => (exitedEarly = true));
      // Junk connections must not extend the lifetime of an otherwise idle run.
      while (Date.now() - startedAt < 9000 && !exitedEarly) {
        const socket = net.connect({ host: "127.0.0.1", port });
        socket.on("error", () => {});
        held.push(socket);
        await sleep(1000);
      }
      if (exitedEarly) {
        ctx.check.pass("gate:no-premature-renew", `run ended after ${Math.round((Date.now() - startedAt) / 1000)}s despite junk connections`);
      } else {
        ctx.check.fail(
          "gate:no-premature-renew",
          "run with a 4s idle deadline was still alive after 9s of junk connections; accepts renew the deadline",
          KNOWN,
        );
      }

      if (await idleClosed) ctx.check.pass("gate:idle-conn-closed", "gate closed a connection that never sent a byte");
      else ctx.check.fail("gate:idle-conn-closed", "a silent connection stayed open for 12s; no gate read timeout", KNOWN);
    } finally {
      for (const socket of held) socket.destroy();
      cli.kill();
      await cli.exited;
    }
  }
}
