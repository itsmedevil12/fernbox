# FernBox

> **Status: early, and honest about it.** Everything described below is built and
> tested. What is *not* built is listed under [Not built yet](#not-built-yet) —
> read that section before assuming a feature exists.

FernBox runs untrusted JavaScript inside a hard-limited sandbox, on your machine,
without giving it your machine. A real V8 isolate, a small virtual POSIX
filesystem, a per-run process boundary, and a Rust daemon that owns everything the
script is not allowed to touch.

```js
// main.js
const requests = Number(process.env.REQUESTS || 3);
for (let i = 1; i <= requests; i++) console.log(`tick ${i}`);
JSON.stringify({ platform: process.platform, cwd: process.cwd() });
```

```sh
fernbox run ./my-app --env REQUESTS=2 --stream
```

The script wrote to a fake filesystem, read a fake environment, and ran in a
process that had no host path, no host environment, and a wall-clock deadline.

---

## Why

Running someone else's JavaScript means trusting it not to read `~/.ssh`, not to
`curl` your internal network, and not to loop forever. The usual answers are a
container (heavy, and a real kernel underneath) or a Worker (not a security
boundary). FernBox is a third option: a V8 isolate with a virtual filesystem and a
process boundary, small enough to embed and strict enough to hand to code you do
not trust.

What it is **not**: a container, a VM, or a polyfill for production Node. See
[What this is not](#what-this-is-not).

---

## Install

```sh
git clone https://github.com/your-org/fernbox
cd fernbox
cargo build --release
```

Binaries land in `target/release/`: `fernbox` (CLI), `fernbox-daemon` (the trust
root), `fernbox-worker` (one child process per run). The daemon starts on demand
and keeps its state in `~/.fernbox`.

Requires Rust and Node (Node only to build the runtime bundle at compile time).

---

## Quick start

```sh
mkdir my-app && cd my-app
cat > main.js <<'EOF'
const n = Number(process.env.N || 3);
let total = 0;
for (let i = 1; i <= n; i++) total += i;
`sum 1..${n} = ${total}`;
EOF

fernbox run .
```

```
completed: sum 1..3 = 6
```

### Persistent state

A volume is a directory that survives the run. Only its mount subtree persists
everything else is discarded with the worker.

```sh
fernbox run ./counter --volume data:/data    # reads and writes /data
fernbox volumes                              # what exists
fernbox inspect data                         # a tree of what is in it
```

### Live output

```sh
fernbox run ./long-task --stream
```

`--stream` relays each chunk as the script writes it, so a long run shows progress
instead of a blank terminal. Without it, output arrives once at the end.

### Development loop

```sh
fernbox dev ./my-app
```

Re-runs on every save — watching is what `dev` does, there is no flag to enable
it. Each save boots a fresh worker, so nothing carries over except volumes, which
is the point: what you see is what a real run sees. Output is always streamed
under `dev`.

### Serving HTTP

```js
// api/main.js
const http = require("http");
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "hello world" }));
});
server.listen(Number(process.env.PORT || 8080), "127.0.0.1", () => "listening");
```

```sh
fernbox run ./api --publish 8080 --max-life-ms 3600000 --env PORT=8080
curl 127.0.0.1:8080/json
```

`--publish` is a **grant, not a policy**: the daemon binds that loopback port and
forwards what arrives, and `http.listen` is refused without it. The script never
opens a socket itself.

---

## Images and `FernBoxfile`

An image is the filesystem a script boots with. Five ship inside the binary:
`minimal`, `base`, `fernos`, `alpine`, `ubuntu`. Pick one with `--image`.

```sh
fernbox images
fernbox run ./my-app --image alpine
```

To build your own, write a **FernBoxfile** — a handful of keywords, no compiler
involved:

```dockerfile
# FernBoxfile
FROM base
WORKDIR /app
ENV NODE_ENV=production
COPY ./src /app
RUN mkdir -p /node_modules/dep && cat /app/vendor/dep.js > /node_modules/dep/index.js
CMD /app/main.js
```

```sh
fernbox build -t my-app
fernbox run ./empty --image my-app --entrypoint /app/main.js
```

| Keyword | Meaning |
| --- | --- |
| `FROM <image>` | layer on this image; required, exactly once |
| `COPY <host> <image>` | copy a file or tree in; the source stays inside the build context |
| `RUN <command>` | execute a shell command during the build |
| `ENV <KEY>=<value>` | an environment default |
| `CMD <path>` | the entrypoint a run uses when none is given |
| `WORKDIR <path>` | recorded for reference; the runtime has no `cd` |

**`COPY` respects `.gitignore`.** A build context that ignores `node_modules` does
not copy it, which is what keeps a real project's image small enough to boot. A
`.fernboxignore` is read too, after `.gitignore`, so a project can re-include
something in its image without fighting its VCS. The ignore files themselves are
never copied in.

**`RUN` is sandboxed.** A build step boots a real worker with the image so far
mounted at `/`, runs the command through the image's own shell, and takes the
resulting filesystem as the next layer. It gets no network unless the build grants
it, and a deadline like any other run. It cannot do anything at build time that
the same command could not do at run time — which is the only reason it is
acceptable at all.

A failing step fails the build and writes **no image**: a half-built image would
break later, far from the command that broke it.

### Committing a volume

`commit` freezes a volume into a named image, which is the other way to make one:

```sh
fernbox run ./setup --volume data:/data
fernbox commit data my-image --from base
fernbox run ./app --image my-image
```

---

## Performance

Measured with `bench/run.mjs` on Linux x86_64, release binaries, one endpoint per
measurement window, a fresh TCP connection per request (the gate does not keep
connections alive, and the Node baseline disables keep-alive to match).

| Framework | Node RPS | FernBox RPS | FernBox / Node | Startup ms (Node → FernBox) | RSS MB (Node → FernBox) |
| --- | ---: | ---: | ---: | ---: | ---: |
| express | 4129.7 | 3342.9 | 80.9% | 222 → 948 | 146.3 → 148.3 |
| koa | 4540.5 | 3577.9 | 78.8% | 207 → 898 | 141.8 → 159.3 |
| fastify | 4503.3 | 3608.7 | 80.1% | 209 → 945 | 147.7 → 160.2 |

**Reading these honestly.** Throughput is about 80% of plain Node, and the
difference is the price of the process boundary — a request crosses the daemon's
gate and a worker's protocol instead of staying in one process. Startup is ~4×
slower because a run boots a worker and its isolate.

Each app is measured on five endpoints, not one, because they exercise different
work in a runtime — a router, a JSON parser, a serializer, and a 404 that still
runs the router:

| Framework | Runtime | GET /json | GET /plain | GET /users/:id?q= | POST /echo | GET /missing |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| express | node | 4129.7 | 4538.1 | 4509.6 | 4497.1 | 4643.9 |
| express | fernbox | 3342.9 | 3343.9 | 3341.6 | 3140.6 | 3236.6 |
| koa | node | 4540.5 | 4759.8 | 4690.5 | 4481.2 | 4552 |
| koa | fernbox | 3577.9 | 3670.2 | 3578.7 | 3439 | 3578.6 |
| fastify | node | 4503.3 | 4625.5 | 4525.3 | 4478.1 | 4592.8 |
| fastify | fernbox | 3608.7 | 3760.4 | 3667 | 3467.6 | 3633.4 |

Building an image is cheap because nothing executes unless you ask it to:

| Build | ms | files/s |
| --- | ---: | ---: |
| `COPY` only, 500 files | 56 | 8929 |
| `COPY` + one `RUN` | 187 | — |

The ~130 ms gap is what a build step costs: a worker boot plus a filesystem
snapshot. **These numbers are one machine on one day.** Run them yourself:

```sh
cd bench/apps && npm install && cd ../..
node bench/run.mjs --duration 6 --warmup 2
node bench/run.mjs --targets express --no-baseline
node bench/run.mjs --no-build --build-files 2000
```

Reports go to `bench-results/` as JSON and Markdown.

---

## How it works

```
CLI / napi ──TCP──▶ daemon ──spawn──▶ worker ──▶ V8 isolate
                   (trust root)  (one per run)    two contexts
                        ▲                            │
                        └──── result, stdout, volume snapshot

host curl ──TCP──▶ daemon gate ──forward──▶ worker ──▶ user-realm handler
```

| crate | role | runs untrusted JS? |
| --- | --- | --- |
| `core` | the isolate, the virtual OS, net policy, images and seeds | no — a library |
| `proto` | wire framing between client and daemon | no |
| `client` | the TCP client the CLI and napi share | no |
| `cli` | `run / dev / images / volumes / inspect / commit / build` | no |
| `daemon` | the trust root: state dir, volumes, images, worker spawning | **never** |
| `worker` | one child process, one isolate, one run | **yes** |
| `napi` | the same client as a Node addon | no |

The load-bearing idea is **two contexts in one isolate**: the system context holds
the virtual OS and is trusted; the user context holds the script and reaches the
operating system only through a `fernbox` object whose every call is validated on
the system side. A worker never sees a host path, the state directory, or a net
policy — it gets an already-resolved seed and a deadline, and the daemon treats
everything it says as untrusted.

See [`Architecture.md`](Architecture.md) for the full design,
[`SECURITY.md`](SECURITY.md) for the threat model, and [`images.md`](images.md)
for what each image contains.

---

## What this is not

- **Not a container.** There is no kernel, no namespaces, no cgroups. The boundary
  is a V8 isolate inside a child process, plus a daemon that validates what the
  child reports.
- **Not production Node.** The filesystem is a flat map of utf8 paths to text:
  no symlinks, no permissions, no inodes, no timestamps, no binary files.
- **Not a polyfill for every Node API.** Implemented: `fs`, `path`, `os` (partial),
  `process`, `http` (server and client), `child_process` (the builtin commands),
  `require`, `fetch`, `Buffer`, `URL`, `crypto` (partial), `events`, `stream`,
  `zlib` (`fflate`-backed, for `npm`). Missing: `worker_threads`, `cluster`,
  `net`/`tls` sockets, `dgram`, `vm`, and anything native.
- **Not multi-tenant.** Anyone holding the daemon token can run code. Put your own
  policy proxy in front of it before sharing it.
- **Not Windows-verified in this repo's CI.** Development has been on Linux; the
  design is Windows-first and the daemon's process handling has Windows paths, but
  the benchmark workflow is the only thing running anything automated.

---

## Not built yet

Stated plainly, because a README that overstates is worse than none:

| Missing | Notes |
| --- | --- |
| HTTP keep-alive, chunked responses, SSE, WebSockets | The gate frames by `Content-Length` and closes. This is the single largest performance cost. |
| `crypto.randomBytes` | Present but limited; not the full surface |
| Symlinks | The filesystem has none, by design |
| `RUN` inside a multi-stage build | No `FROM ... AS`, no `COPY --from` |
| Streaming hot-reload for serving runs | `dev --watch` re-runs; a serving run needs a proto kill path |
| A CI job that runs the test suite | Only `benchmark.yml` exists, and it is Windows-only |

Known security findings are tracked in [`SECURITY.md`](SECURITY.md) as notes;
they are not silently fixed or silently ignored.

---

## Testing

```sh
cargo build --workspace
cargo test --workspace
```

Build first: integration tests run the real binaries, and `cargo test -p
fernbox-daemon` does **not** rebuild `fernbox-worker`. See
[`TESTING.md`](TESTING.md) for that gotcha, the mutation-checking discipline used
here, and why the streaming tests assert *when* output arrives rather than what it
says.

---

## Documents

| File | What it covers |
| --- | --- |
| [`Architecture.md`](Architecture.md) | the design, the two-context boundary, what is proposed |
| [`SECURITY.md`](SECURITY.md) | threat model, trust boundaries, audit notes |
| [`images.md`](images.md) | every image, every command, and the FernBoxfile format |
| [`TESTING.md`](TESTING.md) | how to run tests, and how to check they test something |

## License

See `Cargo.toml` in the workspace root.
