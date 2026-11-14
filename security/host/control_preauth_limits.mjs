import net from "node:net";
import { closedWithin, sleep } from "../lib/hostkit.mjs";

export const meta = {
  title: "Control port: unauthenticated peers are cut off (oversized frames, stalls, connection floods)",
  finding: "FBX-005",
};

const KNOWN = { known: "FBX-005" };
const STALL_MS = 8000;

const prefix = (length) => {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(length);
  return buf;
};

export async function run(ctx) {
  const port = ctx.daemon.port;

  const cases = [
    ["idle-no-bytes", () => {}],
    ["oversized-prefix-96MiB-then-stall", (socket) => socket.write(prefix(96 * 1024 * 1024))],
    ["oversized-prefix-4GiB-then-stall", (socket) => socket.write(prefix(0xffffffff))],
    ["partial-prefix-then-stall", (socket) => socket.write(Buffer.from([0, 0]))],
    [
      "partial-auth-frame-then-stall",
      (socket) => socket.write(Buffer.concat([prefix(200), Buffer.from('{"type":"auth","tok')])),
    ],
  ];
  const results = await Promise.all(
    cases.map(async ([name, onOpen]) => [name, await closedWithin(port, STALL_MS, onOpen)]),
  );
  for (const [name, closed] of results) {
    if (closed) ctx.check.pass(`preauth:${name}`, `daemon closed the socket within ${STALL_MS}ms`);
    else ctx.check.fail(`preauth:${name}`, `still open after ${STALL_MS}ms; no read timeout or size cap before auth`, KNOWN);
  }

  // A flood of idle sockets must not stop an authenticated client from being served.
  const held = [];
  const FLOOD = 300;
  await Promise.all(
    Array.from({ length: FLOOD }, () => {
      return new Promise((resolve) => {
        const socket = net.connect({ host: "127.0.0.1", port });
        socket.on("error", () => resolve());
        socket.on("connect", () => {
          held.push(socket);
          resolve();
        });
      });
    }),
  );
  try {
    const result = await ctx.cli(["--state-dir", ctx.stateDir, "volumes"], { wallMs: 15000 });
    if (result.code === 0 && !result.timedOut) {
      ctx.check.pass("preauth:flood-then-client", `${held.length} idle sockets open; a real request still succeeded in ${result.ms}ms`);
    } else {
      ctx.check.fail(
        "preauth:flood-then-client",
        `with ${held.length} idle sockets open the CLI got exit ${result.code}${result.timedOut ? " (timed out)" : ""}`,
        KNOWN,
      );
    }
  } finally {
    for (const socket of held) socket.destroy();
  }

  // Bounded: how many of the idle sockets did the daemon drop on its own?
  const stillOpen = await new Promise((resolve) => {
    const sockets = [];
    let open = 0;
    let done = 0;
    const total = 20;
    for (let i = 0; i < total; i++) {
      const socket = net.connect({ host: "127.0.0.1", port });
      sockets.push(socket);
      let counted = false;
      const settle = () => {
        if (counted) return;
        counted = true;
        done++;
        if (done === total) resolve(open);
      };
      socket.on("error", settle);
      socket.on("close", settle);
      socket.on("data", () => {});
      setTimeout(() => {
        if (!counted && !socket.destroyed) open++;
        socket.destroy();
        settle();
      }, STALL_MS);
    }
  });
  if (stillOpen === 0) ctx.check.pass("preauth:idle-sockets-reaped", "no idle socket survived the stall timeout");
  else ctx.check.fail("preauth:idle-sockets-reaped", `${stillOpen}/20 idle sockets were still open after ${STALL_MS}ms`, KNOWN);

  await sleep(200);
  if (await ctx.daemon.alive()) ctx.check.pass("preauth:daemon-survives", "daemon still accepts connections");
  else ctx.check.fail("preauth:daemon-survives", "daemon stopped accepting after the pre-auth abuse", KNOWN);
}
