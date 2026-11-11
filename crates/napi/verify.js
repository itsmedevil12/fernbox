// End-to-end check of the JS client against a live daemon.
//
// Mirrors the CLI verification: the counter must increment across two runs on
// a volume, the listings must see what the runs left behind, a commit must
// freeze the volume over a base layer, and a bad token must reject — a run's
// outcome is data and resolves, an unreachable or refusing daemon does not.
//
// Run `fernbox-daemon serve --state-dir <tmp>` first, then `node verify.js`.
const assert = require('assert');
const os = require('os');
const path = require('path');
const fernbox = require('./fernbox.node');

const STATE = path.join(os.tmpdir(), 'fernbox-js-verify');
const APP = path.resolve(__dirname, '../../fixtures/apps/counter');
const daemon = { stateDir: STATE };

async function main() {
  // 1. Two runs on one volume: the counter increments, so the mount survived.
  const first = await fernbox.run({ appDir: APP, volumes: ['data:/data'], ...daemon });
  assert.strictEqual(first.outcome, 'completed', `first run: ${first.message}`);
  assert.ok(first.value.includes('count=1'), `first run value: ${first.value}`);

  const second = await fernbox.run({ appDir: APP, volumes: ['data:/data'], ...daemon });
  assert.strictEqual(second.outcome, 'completed', `second run: ${second.message}`);
  assert.ok(second.value.includes('count=2'), `second run value: ${second.value}`);
  console.log(`two runs ok: ${first.value} | ${second.value}`);

  // 2. The listings reflect the runs.
  const volumes = await fernbox.volumes(daemon);
  assert.ok(volumes.includes('data'), `volumes: ${JSON.stringify(volumes)}`);
  console.log(`volumes ok: ${JSON.stringify(volumes)}`);

  const images = await fernbox.images(daemon);
  assert.ok(images.some((i) => i.name === 'base'), `images: ${JSON.stringify(images)}`);
  console.log(`images ok: ${JSON.stringify(images)}`);

  // 3. Commit freezes the volume over the base, so a run on the image alone
  // still sees /etc/hosts from underneath and the count from above.
  const committed = await fernbox.commit('data', 'jsimage', 'base', daemon);
  assert.ok(committed, `commit: ${committed}`);
  console.log(`commit ok: ${committed}`);

  const frozen = await fernbox.run({ appDir: APP, image: 'jsimage', ...daemon });
  assert.strictEqual(frozen.outcome, 'completed', `frozen run: ${frozen.message}`);
  assert.ok(frozen.value.includes('count=3'), `frozen run value: ${frozen.value}`);
  assert.ok(frozen.value.includes('hosts='), `frozen run value: ${frozen.value}`);
  console.log(`committed image ok: ${frozen.value}`);

  // 4. A bad token is the caller's problem, so it rejects rather than resolving
  // to some outcome.
  await assert.rejects(
    () => fernbox.run({ appDir: APP, token: 'not-the-real-token', ...daemon }),
    /start one with `fernbox-daemon serve`|refused/i,
  );
  console.log('bad token ok: rejected');

  // 5. An app dir the caller cannot read is not one the daemon can run, so it
  // rejects rather than resolving to an outcome. The client resolves a relative
  // path against the caller's own cwd first, so the probe has to be a path that
  // is missing there too — a folder that exists relative to the repo root would
  // be silently absolutised and the check would pass for the wrong reason.
  await assert.rejects(
    () => fernbox.run({ appDir: 'fixtures/apps/no-such-app', ...daemon }),
    /cannot be read|absolute|not found/i,
  );
  console.log('missing appDir ok: rejected');

  // 6. The caller's env and args are the whole of what the sandbox sees of
  // either, and a `console.log` reaches the caller as stdout.
  const identity = await fernbox.run({
    appDir: path.resolve(__dirname, '../../fixtures/apps/argv_env'),
    env: ['FOO=bar', 'EMPTY='],
    args: ['one', 'two'],
    ...daemon,
  });
  assert.strictEqual(identity.outcome, 'completed', `identity: ${identity.message}`);
  const seen = JSON.parse(identity.value);
  assert.strictEqual(seen.env, 'bar', `identity env: ${JSON.stringify(seen)}`);
  assert.strictEqual(seen.empty, '', `identity env: ${JSON.stringify(seen)}`);
  assert.deepStrictEqual(seen.args, ['one', 'two'], `identity argv: ${JSON.stringify(seen)}`);
  assert.strictEqual(seen.argv0, 'node', `identity argv0: ${JSON.stringify(seen)}`);
  assert.strictEqual(identity.output, '', `identity output: ${JSON.stringify(identity.output)}`);
  console.log(`env and argv ok: ${identity.value}`);

  // 7. A `/bin` shim is a module an app requires and calls, and its output
  // arrives on the run's stdout.
  const shims = await fernbox.run({
    appDir: path.resolve(__dirname, '../../fixtures/apps/shims'),
    ...daemon,
  });
  assert.strictEqual(shims.outcome, 'completed', `shims: ${shims.message}`);
  assert.strictEqual(shims.value, 'shims ok', `shims value: ${shims.value}`);
  assert.ok(/hostname/.test(shims.output), `shims output: ${shims.output}`);
  assert.ok(/cat of a missing file exited 1/.test(shims.output), `shims output: ${shims.output}`);
  console.log(`shims ok: ${shims.output.trim().split('\n').length} lines of stdout`);

  // 8. What the caller piped in is the whole of `process.stdin`, the same way
  // env and args travel — and consumed once, so a second read is EOF.
  const piped = await fernbox.run({
    appDir: path.resolve(__dirname, '../../fixtures/apps/stdin'),
    stdin: 'alpha\nbeta\n',
    ...daemon,
  });
  assert.strictEqual(piped.outcome, 'completed', `stdin: ${piped.message}`);
  assert.deepStrictEqual(
    JSON.parse(piped.value),
    { first: 'alpha', second: 'beta', eof: null },
    `stdin: ${piped.value}`,
  );
  console.log(`piped stdin ok: ${piped.value}`);

  console.log('all checks passed');
}

main().catch((err) => {
  console.error(`failed: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
