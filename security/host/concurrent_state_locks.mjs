import fs from "node:fs";
import path from "node:path";
import { sleep, tempApp } from "../lib/hostkit.mjs";

export const meta = {
  title: "State store: concurrent runs, commits and listings never see torn or corrupt state",
  finding: "FBX-010",
};

const KNOWN = { known: "FBX-010" };
const VOLUME = "sec-lock-vol";

const WRITER = `
const fs = require("fs");
const id = process.env.WRITER_ID;
for (let i = 0; i < 150; i++) {
  fs.writeFileSync("/data/w" + id + "-" + i + ".txt", "x".repeat(2048) + i);
}
console.log("wrote");
`;

function jsonFiles(dir) {
  const out = [];
  const walk = (current) => {
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json") && entry.name !== "daemon.json") out.push(full);
    }
  };
  walk(dir);
  return out;
}

export async function run(ctx) {
  const app = tempApp(ctx, { "main.js": WRITER });
  const stateArgs = ["--state-dir", ctx.stateDir];
  let stop = false;

  const torn = new Set();
  const poller = (async () => {
    const volumeFile = path.join(ctx.stateDir, "volumes", `${VOLUME}.json`);
    while (!stop) {
      for (const file of [volumeFile, ...jsonFiles(path.join(ctx.stateDir, "images"))]) {
        let text;
        try {
          text = fs.readFileSync(file, "utf8");
        } catch {
          continue;
        }
        try {
          JSON.parse(text);
        } catch {
          torn.add(`${path.basename(file)} (${text.length} bytes)`);
        }
      }
      await sleep(2);
    }
  })();

  const failures = [];
  const note = (label, result) => {
    if (result.timedOut) failures.push(`${label}: timed out`);
    else if (/expected|unexpected end|EOF|parse|corrupt|invalid (json|state)|trailing/i.test(result.stderr + result.stdout) && result.code !== 0) {
      failures.push(`${label}: ${(result.stderr || result.stdout).trim().slice(0, 120)}`);
    }
  };

  const writers = Array.from({ length: 4 }, (_, i) =>
    ctx
      .cli([...stateArgs, "run", app, "--entrypoint", "main.js", "--volume", `${VOLUME}:/data`, "--env", `WRITER_ID=${i}`, "--deadline-ms", "60000"], {
        wallMs: 90000,
      })
      .then((result) => note(`writer${i}`, result)),
  );

  const readers = (async () => {
    let n = 0;
    while (!stop) {
      const results = await Promise.all([
        ctx.cli([...stateArgs, "volumes"]),
        ctx.cli([...stateArgs, "inspect", VOLUME]),
        ctx.cli([...stateArgs, "commit", VOLUME, "sec-lock-same"]),
        ctx.cli([...stateArgs, "commit", VOLUME, "sec-lock-same"]),
        ctx.cli([...stateArgs, "commit", VOLUME, `sec-lock-${n}`]),
      ]);
      results.forEach((result, i) => note(`reader${n}.${i}`, result));
      n++;
    }
  })();

  await Promise.all(writers);
  stop = true;
  await Promise.all([readers, poller]);

  if (torn.size === 0) ctx.check.pass("locks:no-torn-reads", "every host-side read of volume/image JSON parsed");
  else ctx.check.fail("locks:no-torn-reads", `partially written state observed: ${[...torn].slice(0, 3).join(", ")}`, KNOWN);

  if (failures.length === 0) ctx.check.pass("locks:cli-clean", "no CLI call reported corrupt state or hung");
  else ctx.check.fail("locks:cli-clean", failures.slice(0, 3).join(" | "), KNOWN);

  const corrupt = [];
  for (const file of jsonFiles(ctx.stateDir)) {
    try {
      JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      corrupt.push(path.relative(ctx.stateDir, file));
    }
  }
  if (corrupt.length === 0) ctx.check.pass("locks:final-state-parses", "all state JSON files parse after the storm");
  else ctx.check.fail("locks:final-state-parses", `corrupt after the storm: ${corrupt.slice(0, 3).join(", ")}`, KNOWN);

  const listing = await ctx.cli([...stateArgs, "inspect", VOLUME]);
  const files = listing.stdout.split("\n").filter((line) => /w\d-\d+\.txt/.test(line)).length;
  if (files >= 4 * 150) ctx.check.pass("locks:no-lost-writes", `volume holds ${files} of ${4 * 150} written files`);
  else ctx.check.fail("locks:no-lost-writes", `only ${files} of ${4 * 150} files from concurrent runs survived`, KNOWN);
}
