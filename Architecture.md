# FernBox — Architecture

> **Status: incomplete.** This document describes what is built today, and marks
> everything that is not. Sections tagged **proposed** are design notes for work
> that has no code behind it yet — the sandbox-to-sandbox network design is a
> sketch with open questions, not a decision. Long-running services and the
> host-facing loopback gate are built. Read the status tags before trusting
> anything here as a description of the system.

FernBox runs untrusted JavaScript on a host without giving it the host. It is a
Rust service around a real V8 (`rusty_v8`), Windows-first, that boots a small
virtual operating system inside the isolate and presents the script a
Node-shaped surface to program against.

## The shape of a run

```
CLI / napi ──TCP──▶ daemon ──spawn──▶ worker ──▶ V8 isolate
                   (trust root)  (one per run)    two contexts
                        ▲                            │
                        └──── result, stdout, volume snapshot

host curl ──TCP──▶ daemon gate ──forward──▶ worker ──▶ user-realm handler
                  (127.0.0.1:PORT,         (base64 request bytes;
                   a --publish grant)       response matched by id)
```

Seven crates, one workspace:

| crate | role | runs untrusted JS? |
|---|---|---|
| `core` | the isolate, the virtual OS, net policy, image and seed types | no — it is a library |
| `proto` | the wire framing between client and daemon | no |
| `client` | the TCP client the CLI and napi share | no |
| `cli` | `fernbox run / images / volumes / inspect / commit / build` | no |
| `daemon` | the trust root: state dir, volume persistence, image commits and builds, worker spawning | **never** — it links no `Vm::new` path |
| `worker` | a short-lived child process that boots one isolate and answers one run | **yes** |
| `napi` | the same client as a Node addon | no |

A run is one-shot. The daemon spawns a fresh worker per run, the worker boots
the isolate from an embedded image plus the app folder, runs the script, captures
the completion value and the stdio, snapshots the volumes, and exits. There is no
warm isolate waiting, and no sandbox survives its own run. A run may be a
long-running service rather than a batch script — see "Long-running services" —
but it is still one worker, one isolate, and one run that ends when its deadline
or its server does.

The worker is the only process that holds untrusted code. It never sees a host
path, the state directory, or a `NetPolicy` — it receives an already-resolved
seed and a deadline, and its replies are treated as untrusted data by the daemon
(volume file maps are path-checked and quota-checked before they are written).

## The two-context boundary

*Status: built. This is the load-bearing wall; everything else is furnishing.*

One isolate, two contexts:

- **The system context** holds the virtual OS and a `__fernbox` object. Its code
  (`runtime/src/index.js`) ships with the daemon and is trusted.
- **The user context** holds the script, the Node-shaped boot bundle
  (`runtime/src/user/`), and a frozen `fernbox` object. That object is the only
  bridge between the two.

The rule, borrowed from the vm2 line of reasoning: **no object ever crosses the
boundary.** Every call into the system context marshals its arguments to owned
Rust strings; every answer comes back as JSON text that the user realm parses and
rebuilds itself. Primitives are safe. A handle, a closure, a prototype — those
are not, and the boundary is only as strong as the discipline of never handing
one across. `call_system` in `crates/core/src/vm.rs` is the single chokepoint
through which everything passes, and the boot bundle is where that discipline has
to hold: if anything in `runtime/src/user/` reached for a system-context handle,
the isolation would be a fiction.

The chokepoint the script actually sees:

```
fernbox.read(path)              fernbox.write(path, data)     fernbox.list()
fernbox.fs.stat(path)           fernbox.fs.exists(path)
fernbox.stdio.write(text)
fernbox.http.fetch(url, opts)
fernbox.http.listen(port, dispatch)   fernbox.http.respond(id, rawB64)   fernbox.http.close()
fernbox.setTimeout / setInterval / clearTimeout / clearInterval
```

Every one of those is a string in and a string out. `fs`, `path`, `os`, `http`,
`child_process`, and `shell` in the boot bundle are ordinary JS built on top of
it; they are frozen so a script cannot swap `fs.readFileSync` for one that reads
past the policy, because the chokepoint beneath them is what decides.

## The virtual filesystem

*Status: built.*

Four layers, merged with `unionfs`:

```
base      memfs seeded from the embedded image, wrapped read-only
volumes   one writable memfs per attached mount (`--volume name:/mount`)
writable  an empty memfs, searched first — a written path shadows the image
link      `/tmp` and `/var/tmp` redirected into a private corner of writable
```

The base image is embedded in the binary and shared by every isolate, so it must
reject mutation: it is a `Proxy` over a set of mutating method names that throws
`EPERM`. `unionfs` would otherwise route a write to whichever layer already holds
the file, which would put writes into the image. Searching `writable` first and
denying writes on the base together make every write land in the writable layer,
overlayfs-style ancestor copy-up included.

Only the volume subtrees survive the run. The daemon persists them between runs,
`fernbox inspect NAME` shows what one holds as a sized tree, and `fernbox commit`
freezes one into a new base image.

## How the runtime is built and shipped

*Status: built.*

`crates/core/build.rs` runs `node build.mjs <OUT_DIR>` at compile time, which
esbuilds two IIFE bundles — `virtual_os.js` for the system context,
`user_runtime.js` for the user context — and each image under
`runtime/images/` into `image_<name>.json`. All of it is embedded with
`include_str!`, so a binary carries its whole filesystem and never reads one from
disk at runtime. The registry is generated by listing the images directory, so a
new image is a new directory and no Rust change.

Five images ship today, and they are **personalities, not distributions**. The
filesystem is utf8 text with no symlinks, no permissions, and no binaries, so an
image cannot be Alpine or Ubuntu in any sense that a program could verify beyond
the files it sees and the commands that answer. What an image actually chooses is
a layout and a userland:

```
minimal  the floor: /etc, no commands at all
base     minimal + /bin (cat, echo, ls, mkdir, mv, node, npm, printenv, pwd, rm,
         rmdir, sh) and the fflate inflator npm needs; the common userland
fernos   base + a small toolbox in /usr/local/bin (cp, touch, head, tail, sort,
         wc, grep, env, uname, whoami, tee) and /etc/fernbox
alpine   minimal + a BusyBox-shaped userland: one multi-call `busybox` in /bin
         behind applet shims, the applets themselves in /usr/lib/busybox, and
         no /usr/local/bin at all
ubuntu   base with Ubuntu's identity files in /etc and nothing else — a real
         distro's usrmerge would make /bin a symlink to /usr/bin, and this fs
         has no symlinks, so the inherited /bin simply is the one /usr/bin
```

An image may declare a parent with a `fernbox.json` the walker never admits into
the filesystem:

```json
{ "from": "base", "description": "what this image layers on and why" }
```

The parent is merged under the child, child wins — the same ordering the daemon's
volume commit uses, so an image overrides an inherited file by shipping its own
copy. The emitted map stays flat: **inheritance is a build-time convenience, not a
runtime concept**, and neither the isolate nor the daemon knows that layers exist.
`base` inherits `minimal` and `alpine` inherits `minimal` rather than `base`, which
is why alpine ships no inherited `/bin` — a distribution brings its own userland.

Two conventions hold the personalities together. `/etc/os-release` is where every
image declares itself, so it is the one path an app can ask "which image am I on"
and always get an answer; and commands are found through a fixed PATH —
`/usr/local/bin`, `/usr/bin`, `/bin`, in `runtime/src/user/commands.js` — shared by
the shell's lookup and by `require`'s refusal, so a directory that holds commands
is never one an app imports a library from. `/usr/bin` is in the list even though
no shipped image fills it: an app can write a command there itself.

This has one consequence an author has to know: **boot-bundle modules are
inlined, so a file inside an image cannot `require` one by path.** What the image
can reach, it reaches by name — which is why the shell grammar is exported as the
builtin `shell`, reached as `require("shell")`, rather than living at a path. It
is also why alpine's applets live at `/usr/lib/busybox/applets.js` rather than in a
command directory: a shim in `/bin` has to be able to require them, and `require`
refuses every directory in the PATH.

## The Node-shaped surface

*Status: built.*

The entry script stays top-level code, like `node -e` with a `require` global,
because **the completion value of the script is the run's result**. Wrapping the
entry in a CommonJS function would throw that value away. Only the modules it
requires get the `(module, exports, require, __filename, __dirname)` wrapper.

The loader (`runtime/src/user/require.js`) resolves files, `.js` and `.json`
suffixes, `index.js`/`index.json`, `package.json` `main`, and walks
`node_modules` up to the root. A bare id is always a package name: only relative
and absolute ids are looked up as files, so an app's own `express.js` cannot
shadow the `express` package. One module cache per context, written before a
module runs so a cycle gets the partially-populated exports the way it does
under Node. A `.json` file is parsed as data, which is how a library reads its
own `package.json`. The `node:` scheme is accepted (`require("node:fs")` is the
same builtin), and there is deliberately no `browser`-field rewriting: the
loader follows Node's rules, because the point is to run packages written for
Node, not packages pre-rewritten for a browser.

### The builtin registry

A framework's dependency tree loads core modules by name, so the boot bundle
ships them as builtins — built once in the user realm, frozen, and the same
object for every requirer:

| module | what is there |
| --- | --- |
| `assert`, `events`, `stream`, `buffer`, `util`, `url`, `querystring`, `string_decoder`, `path` | the browserify polyfills, with WHATWG `URL`/`URLSearchParams` from `whatwg-url` |
| `fs` | text files; sync, callback, and promise forms; `stat`, `createReadStream` with `start`/`end` |
| `crypto` | `createHash`, `createHmac`, `timingSafeEqual`, `getHashes` |
| `http` | the server and client surface described below |
| `net`, `tls`, `https`, `http2` | the shapes a dependency imports, with transport calls refusing by name |
| `async_hooks`, `diagnostics_channel`, `dns`, `module`, `worker_threads` | the load-time shapes frameworks and loggers probe: a synchronous `AsyncResource`/`AsyncLocalStorage`, publish/subscribe, a loopback-only resolver, `createRequire`/`isBuiltin`, and a one-thread refusal |
| `zlib` | constants, and named refusals for every codec |
| `process`, `timers`, `timers/promises`, `fs/promises`, `util/types`, `sys` | the live singletons and Node's aliases |

The globals match: `Buffer`, `URL`, `URLSearchParams`, `TextEncoder`,
`TextDecoder`, `setTimeout`/`setInterval`/`setImmediate` and their clears,
`global`, `process`, `console`, and `require`. The codecs are hand-written in
the boot banner because V8 is ECMAScript only.

**What refuses, and why.** These are named errors, not missing properties, so a
dependency fails at the call that actually needed the host:

- `crypto.randomBytes`/`randomUUID` — `ERR_CRYPTO_NO_ENTROPY`. The isolate has
  no entropy source, and a predictable session secret is worse than an error;
  inject secrets through the environment or a volume instead.
- `zlib.*` — `ERR_ZLIB_UNSUPPORTED`. Compression middleware (`compression`,
  compressed `body-parser` inputs) cannot run; uncompressed bodies can.
- `tls`/`https` calls and `http2` — `ERR_TLS_UNSUPPORTED` /
  `ERR_HTTP2_UNSUPPORTED`. The gate's socket is plain HTTP/1.1.
- `net.connect` and `net.Server#listen` — `ERR_NET_UNSUPPORTED`. `net.Server`
  is still the base class `http.Server` extends, and `net.isIP`/`isIPv4`/
  `isIPv6` are pure.
- `child_process.spawn`/`fork` — a virtual child has no live streams; `execSync`
  is the supported shape.
- `worker_threads.Worker`/`MessageChannel`/`BroadcastChannel` —
  `ERR_WORKER_UNSUPPORTED`. A run is one thread; pino loads the module only to
  answer `isMainThread`.
- `dns` queries — `ERR_DNS_UNSUPPORTED`. There is no resolver; `lookup`
  answers loopback names and IP literals, which is what a framework asks when
  it reports the address it bound.

`AsyncLocalStorage` is shape-honest rather than traced: its store survives a
synchronous `run` and is restored when the callback returns, but the isolate
exposes no promise hooks, so it does not follow an `await`. A framework that
needs request-scoped storage across asynchronous boundaries (some tracing and
request-context plugins) will not get it from this.

**What the fs does not have.** Contents, not metadata: `stat` reports the
moment of the stat as `mtime` (never a stale timestamp that would answer a
conditional request with a wrong 304), there are no symlinks (`realpath` is
normalization), no file descriptors (`createReadStream` is one buffered read,
with byte ranges), and no `watch`. `readFileSync` returns text. An app folder
is walked into that text-only fs at run start; a file that is not valid UTF-8
(a dependency's unused image, say) is skipped with a warning instead of failing
the run, and reading it later is an ordinary `ENOENT`.

**Commands are run, not required.** An image holds its commands in whichever of
the three command directories it likes, and an app reaches one through
`child_process` — `require("/bin/npm.js")` is refused with `ERR_REQUIRE_COMMAND`,
and so is any path under `/usr/bin` or `/usr/local/bin`. This is an interface rule
rather than a permission boundary: nothing in the user realm holds privilege a
shim would confer, since a command's code runs against the same chokepoints the
app's own code does. It keeps the two surfaces as distinct as they are on a real
machine, where a binary is an executable and not a loadable module. The shell's
runner is the one caller allowed past the check, and the loader it uses is not
reachable from app code.

## The simulated shell

*Status: built. Real process isolation is not — see below.*

`child_process.execSync("ls -l | head")` works, and so does the grammar it
implies: quotes and escapes, `;`, `&&`, `||`, `|`, `>`/`>>`, `2>`, `2>&1`, `<`,
comments, and the `cd`/`pwd`/`exit`/`true`/`false` builtins. `execSync` *is*
`sh -c` — one `shell.run` underneath both.

But there is no process. A child is a command shim's `main(args)` invoked in the
same context with `process.stdout`/`stderr`/`stdin`, `cwd`, `env`, and
`exitCode` swapped onto capturing sinks and restored in a `finally`. That is
deliberately the same trust level as `require`-ing the shim, which already
worked: same heap, same fs, same module cache, same deadline. No new privileged
surface exists beneath it.

- Pipes are batch, not streaming: stage N's captured stdout is stage N's stdin.
- `console` resolves its streams at write time, the way Node's `_stdout` getter
  does, so a `console.log` inside a child lands in the capture.
- A child's `process.exit(3)` becomes its status without leaking into the
  parent's `exitCode`, because the swap restores that too.
- A self-invoking shell (`sh -c "sh -c 'sh ...'"`) stops at a depth cap of 16
  with status 126 instead of dying to a V8 `RangeError` that would read like a
  crash. The deadline bounds the recursion in time; this bounds it in space.
- `spawn`, `spawnSync`, and `fork` still throw a named not-implemented error.
  They promise a `ChildProcess` with live streams, which is the virtual-process
  stage's to deliver.

## Network and isolation today

*Status: built, and deliberately narrow.*

Net policy is decided per fetch by `NetPolicy` in the worker, from flags the
caller passed at run time: loopback and RFC 1918 addresses are opt-in, cloud
metadata addresses are always denied. `/etc/hosts` is read **fresh on every
fetch** — DNS is virtual by design, and an app rewriting its own hosts file
changes where its traffic goes. There are two network surfaces: `fetch`, the
outbound client, and `http.createServer`, the inbound server — but neither is a
raw socket. The `net` builtin is a shape without a transport (`net.Socket` is
the `req.socket` stand-in middleware reads; `net.Server` is the base class), and
a server reaches the host only through the daemon's loopback gate, described
under "Long-running services".

The daemon itself binds loopback only, authenticates with a token passed
out-of-band and compared in constant time, and requires auth on the first frame.

The host hardening that is *not* done: POSIX builds get no process sandboxing.
That is a deliberate scope decision, not an oversight.

## Long-running services

*Status: built. The host-facing gate is decided and implemented; sandbox-to-sandbox
is still proposed — see "Network design" below.*

A serving run is the same one-shot worker as any other run, with three things
added: an `http` builtin in the boot bundle, an event loop that stays alive while
a server is listening, and a deadline that renewing activity can push out. The
host reaches the service through a gate the daemon opens on a granted port.

### The `http` builtin

`require("http")` is Node's server **and** client surface. `createServer(handler)`
returns a `net.Server` subclass with `listen(port[, host][, cb])`, `close()`,
`address()`, and the `EventEmitter` surface frameworks register apps with. The
handler gets Node's two classes:

- `IncomingMessage` is a `Readable`: `method`, `url`, `httpVersion`,
  lowercased `headers`, `headersDistinct`, `rawHeaders`, `socket` (with
  `remoteAddress`/`remotePort`, which is what `req.ip` reads), `complete`, and
  the body pushed as bytes on the next tick, so `'data'`/`'end'` arrive after
  the handler has attached its listeners. A convenience `.body` holds the whole
  body as text for the JSON-service case.
- `ServerResponse` is a `Writable`: `statusCode`, `statusMessage`,
  `setHeader`/`getHeader`/`getHeaders`/`getHeaderNames`/`getRawHeaderNames`/
  `hasHeader`/`appendHeader`/`removeHeader`, `writeHead` (object or flat array),
  `write`, `end`, `headersSent`, `flushHeaders`. Writable means middleware can
  pipe into it; `stream.pipe(res)` from a static-file handler works.

`request(urlOrOptions[, options][, cb])` and `get(...)` build the same options
Node takes (string URL or object, headers, method), perform one controlled
`fernbox.http.fetch` when the request ends, and emit a response
`IncomingMessage` with `statusCode`, `statusMessage`, and parsed headers. There
is no socket pool: `Agent`/`globalAgent` exist as shapes, and redirects are not
followed by the client, as under Node.

It is ordinary JS in the user realm, built on three chokepoints —
`fernbox.http.listen`, `fernbox.http.respond`, `fernbox.http.close` — so it
inherits the same string-only boundary as everything else. Request and response
bytes cross as base64; the user realm does the HTTP parsing, not the trust root.

`listen` is authorization-checked against the run's grant: a run with no
published port cannot listen at all (`ERR_PUBLISH`), and a run granted one port
cannot listen on another. One server per run; a second `listen` is `EADDRINUSE`.

**The framing limits are the gate's, and they are what a framework notices.**
The gate buffers a whole request before dispatch (headers ≤ 64 KiB, body ≤ 16
MiB, chunked request bodies refused with 501) and `respond` ships one finished
response, so a response is buffered until `end` and framed with an exact
`Content-Length` and `Connection: close`. That means: no chunked responses, no
keep-alive (one request per connection), no `100-continue` round trip, no
streaming or Server-Sent Events, and no protocol upgrades (WebSocket). A
framework whose request path fits in that shape — routing, middleware, JSON and
form bodies, cookies, ETags, static files, redirects — runs unchanged.

*Verified*: Express 4.18 running over the daemon's gate with `express.json()`,
route params and query strings, `res.cookie`/`res.set`, ETags (through
`createHash`), `express.static` with `Range` requests (206 and `Content-Range`),
and a 404 fallback; Koa 2.15 with async middleware, `ctx.set`, JSON and text
bodies, `ctx.throw(404)`, and `HEAD`; Fastify 4.28 with route params and query
strings, its own JSON body parser, typed replies, and a custom 404 handler.
In the core suite,
`the_http_builtin_serves_a_framework_shaped_handler` covers the request/response
contract, `the_http_builtin_serves_a_koa_shaped_async_handler` covers the async
dispatcher and the `res.socket.writable` guard Koa's `ctx.writable` reads,
`the_node_builtin_surface_a_framework_loads` covers the module tree a framework
loads, and `the_http_client_speaks_to_a_real_server` drives `http.request`
against a real loopback server.

### The event loop and the renewable deadline

The run loop keeps the isolate alive while there are timers **or** a listening
server, the way a Node process stays up while something holds its loop. Each
iteration fires due timers, ships queued responses, and dispatches any forwarded
requests into the user realm; then it parks until the next timer or a fresh
request, whichever is sooner. `res.end` queues a response rather than writing it
inline, so a handler that answers on a later timer is shipped just the same, and
every write happens on the run thread between callbacks — never racing a fetch's
own frame.

The watchdog (`Limited` in `crates/core/src/isolate.rs`) is still the only thing
bounding an untrusted busy loop. `arm_with_cap(deadline, max_life)` starts it:
with `max_life = None` the deadline is hard, exactly the plain-run behaviour. A
serving run passes a lifetime cap, and each request it answers calls
`renew(now + idle)`, pushing the deadline out by another idle budget. Renewal is
clamped to the hard cap and never moves the deadline earlier, so an active
service outlives its initial budget but a run that keeps itself busy forever
still dies at the cap. The watchdog thread re-reads the deadline on every wake,
so a renewal during its sleep moves the target instead of killing.

One constraint an author has to know: **the idle budget must exceed the worker's
boot time**, or the watchdog kills the run during boot before `listen` is ever
reached. The CLI's default idle (`--deadline-ms`, 5000ms) is safely above it.

### The loopback gate

When a run is granted a port (`--publish PORT`), the daemon binds
`127.0.0.1:PORT` and nothing else. This is the decided answer to host → sandbox:
**loopback-only and open.** The grant is the allowlist — there is no token on
this socket, because the token guards the daemon's control port, not a service
the user chose to publish to their own machine. Binding loopback is what keeps it
off the network.

The gate is a bounded byte-pump, not an HTTP server. Per connection (its own
thread, capped at 64 in flight) it buffers the request under hard limits —
headers ≤ 64KB, body ≤ 16MB, chunked encoding refused with 501 — and forwards the
raw bytes to the worker as base64 over the same stdin pipe the seed travelled.
The worker's user realm parses and answers; the response comes back matched by
request id and is written to the waiting connection verbatim. The daemon never
interprets the request line or headers beyond the framing it needs to bound the
read: parsing untrusted bytes in the trust root is exactly what the two-process
split exists to avoid. A per-request timeout (30s) and the run's death — which
drops every pending response channel, unblocking waiters with a 503 rather than a
hang — bound what a local caller can fan out into.

The grant flows end to end: `--publish` / `--max-life-ms` on the CLI (and the
matching `RunOptions` fields in napi) become `ClientRequest::Run.publish` and
`Limits.max_life_ms`, which the daemon forwards as `WorkerRun.publish` /
`max_life_ms`. With a port published and no explicit cap, the daemon defaults the
lifetime to one hour. `fixtures/apps/http_server` is a working JSON service
(health, a persisted counter, echo) and `crates/daemon/tests/http_serve.rs`
exercises it over real TCP, including renewal past the initial idle budget and
the hard cap ending a continuously served run.

## What is missing

The single-sandbox service case is built — an app can listen, serve the host
through the gate, and stay alive while it is active. What remains for the
microservices use case, in the order it bites:

1. **No virtual processes.** `spawn`/`spawnSync`/`fork` still throw named
   not-implemented errors; a child is a same-context shim, not a process.
2. **No sandbox-to-sandbox anything.** Which is the next section.

## Network design — virtual service names

*Status: **proposed for sandbox-to-sandbox. No code exists for the virtual-name
network.** The host-facing gate it contrasts with is built — see "Long-running
services".*

The goal: one sandbox should be able to reach another's service, and the host
should not be in the middle of that call as a socket anyone can probe.

The shape is Docker's: **a virtual domain on a caller-created network.**

```
sandbox A runs a service and publishes it as   api.fernbox.local
sandbox B, on the same network, does fetch("http://api.fernbox.local/")
sandbox C, on a different network, gets no such name — resolution fails
```

A registry maps `name → {sandbox, port}`. The registry is network-scoped: a name
only exists for sandboxes that share the network it was created on.

**Enforcement happens at resolution, not at connection.** The tempting
alternative is to let a sandbox open a real listener and filter the connections it
accepts. That is weaker than it looks: a real port is a real port, and anything
on the host — or another sandbox probing the loopback range — can race the
filter, and the filter has to be right on every connection forever. Resolving the
name first means **there is no address to connect to**: a sandbox not on the
network cannot form the request at all, because the name never resolves to
anything for it. The boundary is the name, and it is checked once, at the place
that already exists — the virtual hosts file read fresh on every fetch.

The seam is already in the code. Today `httpFetch` receives
`read("/etc/hosts") ?? ""` before the URL; that is where a network's membership
would surface as hosts entries. Sandbox-to-sandbox traffic would then never need
a real socket at all — the runtime short-circuits a resolved `*.fernbox.local`
destination straight to the target sandbox's in-memory response queue, and no
port is ever opened.

**Host → sandbox is a different question and a weaker one, and it is now decided
and built** — see "Long-running services". A sandbox that serves the host is
reachable through a real loopback socket the daemon opens on a granted port: a
*gate* rather than a wall, loopback-only and open, the grant being the allowlist.
Isolation by resolution only holds between two things that both resolve through
the virtual DNS, so the host-facing path deliberately does not use it. What is
still proposed here is the sandbox-to-sandbox half.

Open questions for the virtual-name network, deliberately left open:

- Where does the registry live — per daemon, in the state dir, keyed by network?
- What *is* a network: a label on a run request, or a first-class object the
  caller creates and names?
- How does a sandbox publish a *name* — a privileged call, or a declaration in
  the run request? (Publishing a *port* to the host is settled: a `--publish`
  declaration the daemon grants.)
- Does network membership write `/etc/hosts` implicitly, or does the app still
  write its own the way `fixtures/apps/npm_install` does today for the registry?
- Does sandbox → host stay subject to the existing `NetPolicy`?
- Naming and collision: who owns a name on a network, and what happens to a
  published name when its sandbox's run ends and the isolate is gone?

## Conventions that keep the boundary honest

- Exception safety is load-bearing. The `finally` that restores stdio, cwd, env,
  and `exitCode` after a child is what keeps a throwing shim from leaving the
  whole run's stdout captured.
- Nothing the worker needs may travel on the command line — `tasklist` is
  world-readable. State goes over the wire, not through `argv`.
- Worker replies are untrusted data. The daemon path-checks and quota-checks a
  volume map before it writes a single file of it.
- The daemon never auto-starts, and never executes untrusted code.
- No backwards-compatibility shims: a removed builtin is removed, not renamed and
  stubbed. Except `spawn`/`fork`, which stay as named not-implemented errors so
  the failure says what is missing instead of "cannot find module".

## Where things live

```
crates/core/src/vm.rs        the two contexts, the chokepoint, the run loop
crates/core/src/isolate.rs   the renewable watchdog and the heap limiter
crates/core/src/server.rs    the request/response types the gate and loop share
crates/core/src/net.rs       address classification, policy
crates/core/src/seed.rs      image and volume composition, validation
crates/daemon/src/           state, serve, spawn, worker management
crates/daemon/src/gate.rs    the loopback gate for a published port
crates/proto/src/lib.rs      wire framing
runtime/src/index.js         the virtual OS (system context)
runtime/src/user/            the Node-shaped surface (user context)
runtime/src/user/builtins/   the core modules: http, fs, stream, crypto, net, url, ...
runtime/src/user/shell.js    the grammar and the runner
runtime/images/*/            the images, one directory each; fernbox.json declares a parent
runtime/build.mjs            the bundle step, and image inheritance
fixtures/                    the apps the tests and examples run
```
