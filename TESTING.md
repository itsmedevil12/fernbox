# Testing

Three kinds of test live in this tree, and they are run the same way.

## Running everything

```sh
cargo test --workspace
```

That is the whole suite: 89 tests, about 25 seconds warm. It builds the daemon,
worker, and CLI first, which is what the integration tests need — they start the
real binaries rather than mocking them.

## Running one thing

```sh
cargo test -p fernbox-cli                     # one crate
cargo test -p fernbox-daemon --test streaming # one integration file
cargo test streamed_output                    # one test, by name
cargo test --workspace -- --nocapture         # let tests print
```

`--test <name>` names a file in `crates/<crate>/tests/`, not a function. `-p`
names a cargo package, so `-p fernbox-cli` for the `fernbox` binary, `-p
fernbox-daemon` for the daemon.

## What the layers check

| Where | What it covers |
| --- | --- |
| `crates/*/src/**` unit tests | Pure logic with no process: path validation, seed composition, the log's glyph widths, the dev watcher's change detection |
| `crates/core` | The isolate itself — the two-context boundary, builtin surface, escape fixtures |
| `crates/daemon/tests/http_serve.rs` | A real published service over real TCP: the gate, renewal, the hard cap |
| `crates/daemon/tests/concurrency.rs` | Two runs at once: volume locks, slot limits |
| `crates/daemon/tests/streaming.rs` | Output arriving *during* a run, not at the end |
| `crates/daemon/tests/build.rs` | A built image running on its own: the FernBoxfile parsed (`RUN` steps and all), `.gitignore` applied, written, and booted with no app folder |

The integration tests spawn `target/debug/fernbox-daemon` (and, through it,
`fernbox-worker`) on a throwaway state directory under the system temp dir, then
talk to it over the real wire protocol. They clean up after themselves, including
on failure, because each holds its daemon in a `Drop` guard.

## The one gotcha

**Integration tests use the binaries cargo built, and `cargo test -p
fernbox-daemon` does not rebuild `fernbox-worker`.** They are separate packages:

```sh
cargo build --workspace        # build the worker too
cargo test --workspace         # then test
```

A stale worker binary makes an integration test quietly check the previous build.
`cargo test --workspace` avoids this because it depends on every crate. It only
bites when you mutate `crates/worker` or `crates/core` and run a single package's
tests — which is exactly what you do when checking that a test catches a
regression.

## Testing a built image

A FernBoxfile build is checked at three levels, and each catches something the
others cannot.

**The parser, in unit tests.** `crates/daemon/src/fernboxfile.rs` holds its own
tests for the parts that never touch a disk: keyword recognition, the
later-keyword-wins rule, and the containment refusals. These are cheap and run
without a daemon.

**The image, end to end.** `crates/daemon/tests/build.rs` builds into a throwaway
state directory and then *runs* the result against an **empty app folder**. That
emptiness is the test: if a file did not make it into the image, there is no copy
on the host to cover for it, so the run fails visibly. The app reads its own config
and `require`s a relative module from inside the image, which checks the tree was
copied with its structure rather than flattened.

**The socket route.** The same file has a test that sends a `Build` request to a
real `serve`, because the CLI builds over the socket while
`fernbox-daemon build` builds locally. Both call the same function; what the test
pins is the plumbing, and that a rejected build writes no image at all.

Two things worth mutating when you change this code, both verified to fail:

1. **Stop clearing the image directory on rebuild** in
   `StateDir::write_image` → `a_rebuild_drops_files_the_build_file_no_longer_copies`
   fails. Without it, a file dropped from a FernBoxfile survives into the next
   build and the image slowly stops matching its own source.
2. **Remove both containment checks** in `resolve_source` → the socket escape test
   fails. Removing only the lexical one leaves the suite green, because the
   canonicalise comparison still catches `..`; that is why the code says so
   explicitly rather than implying each check is load-bearing on its own.
3. **Stop feeding each `RUN` step the previous step's result** in
   `build_request` → `run_steps_execute_in_order_and_their_files_reach_the_image`
   fails. That is the whole claim of the keyword: steps share one filesystem, so
   step 2 can read what step 1 wrote.

The ignore matcher has its own unit tests in `crates/daemon/src/ignore.rs`, one
per rule of the pattern language. The integration tests cover the part those
cannot: that `COPY ./ /app` really does drop `node_modules` and that
`.fernboxignore` can bring a file back.

## Checking that a test actually tests something

A test that cannot fail is worse than no test, so the streaming tests were each
verified against a deliberately broken build:

1. **Drop the chunks** in `crates/daemon/src/worker.rs` (the `Stdout` arm) →
   `streamed_output_arrives_during_the_run_not_at_the_end` and
   `stdout_and_stderr_stay_distinguishable` fail, while
   `without_stream_the_daemon_stays_quiet_until_the_run_ends` correctly still
   passes, since it asserts absence.

2. **Buffer the chunks** in `crates/worker/src/main.rs` and flush them after
   `vm.run` returns — the content is identical, only the timing differs. The
   timing assertion catches it: all three ticks arrive at the same instant
   instead of 400 ms apart.

The second mutation is the one that matters. A test that only compared the final
output would have passed against it, which is why the streaming test asserts
*when* lines arrive and not just what they say.

## Timing-sensitive tests

The streaming test asserts on wall-clock gaps, so it assumes a machine that is
not pathologically loaded. It allows generous slack — three ticks 400 ms apart is
a ~1.2 s run, and the assertion only demands the first arrive within 900 ms — so
a slow CI box has room. If it ever does flake, widen the gaps rather than loose
the assertion: the thing being tested is "spread out, not lumped", and a looser
bound still catches lumping.
