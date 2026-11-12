# FernBox Security Architecture & Audit Specification

> **Status:** Architecture Specification & Codebase Security Audit (`v0.1.0`)
> **Scope:** `fernbox-core`, `fernbox-daemon`, `fernbox-worker`, `fernbox-proto`, `fernbox-client`, `fernbox-cli`, `fernbox-napi`, and `runtime/`

FernBox executes untrusted JavaScript inside an embedded V8 isolate backed by an in-memory POSIX-like virtual operating system, supervised by an out-of-process Rust daemon. This document specifies FernBox's threat model, trust boundaries, defense-in-depth controls, verified security audit findings across the current codebase, security invariants required of all changes, and a prioritized hardening roadmap.

---

## 1. Threat Model & Trust Assumptions

### 1.1 Adversary Profiles

| Adversary | Capabilities | Security Objective |
| :--- | :--- | :--- |
| **A1 — Untrusted Guest Script** | Supplies arbitrary JavaScript executed inside a worker's User V8 Context, including adversarial inputs to `fernbox.*`, Node-compatible built-ins (`fs`, `http`, `path`, `require`), timers, and `/etc/hosts`. | Prevent read/write access to the host filesystem, ambient host environment, System V8 Context secrets, other concurrent or subsequent runs, and unauthorized network endpoints; bound CPU, wall-clock, and memory consumption. |
| **A2 — Malicious Network Peer (Outbound or Inbound)** | Controls remote HTTP servers contacted by `fetch()`/`npm.js` (e.g., redirect chains, oversized bodies, malicious tarballs) or sends arbitrary TCP traffic to a published loopback HTTP gate (`--publish`). | Prevent SSRF to loopback/link-local/private networks, prevent tarball path traversal or decompression bombs, prevent HTTP response splitting, and bound connection/memory exhaustion on the daemon gate. |
| **A3 — Unprivileged Local Host Process** | Runs as a different unprivileged OS user on the same machine with access to the loopback TCP stack (`127.0.0.1`) and process table (`ps` / `tasklist`). | Prevent unauthenticated control of `fernbox-daemon`, prevent pre-authentication memory/connection DoS on the control socket, and prevent leakage of credentials, seeds, or tokens via command-line arguments or world-readable files. |
| **A4 — Post-V8-Escape Worker Code** | Achieves arbitrary native code execution inside `fernbox-worker` via a V8 JIT/runtime vulnerability. | Contain blast radius at the OS process boundary so a compromised worker cannot read `~/.fernbox/daemon.json`, mutate host files, spawn child processes, open raw sockets undetected, or corrupt persistent volumes/images outside policy. |

### 1.2 Explicit Non-Goals & Operator Trust Assumptions

1. **Authenticated Daemon Callers Are Administratively Trusted for Policy Selection:** Any caller possessing the 256-bit hex token in `~/.fernbox/daemon.json` can invoke `ClientRequest::Run`, mount host directories as app seeds, attach named volumes, commit volumes to images, and publish loopback ports. Multi-tenant deployments MUST place a tenant-aware policy proxy in front of `fernbox-daemon` rather than sharing `daemon.json` with untrusted tenants.
2. **Standalone `fernbox-worker sandbox` & N-API In-Process Paths:** Running `fernbox-worker sandbox` (`crates/worker/src/main.rs:94`) or `fernbox-napi` (`crates/napi/src/lib.rs`) executes V8 without the daemon's OS-level worker spawn restrictions (`DirectNet` runs in-process). Production untrusted execution MUST route through `fernbox-daemon`.
3. **Microarchitectural Side Channels:** Same-isolate context separation does not defend against Spectre-class speculative reads within a single `fernbox-worker` address space. High-value secrets MUST never be placed in the System V8 Context heap; the daemon holds long-lived secrets out-of-process.

---

## 2. Security Architecture & Trust Boundaries

```text
+-----------------------+       TCP 127.0.0.1 (Length-Prefixed JSON + 32B Hex Token)
| fernbox-cli / client  | ---------------------------------------------------------------+
+-----------------------+                                                                |
                                                                                         v
+----------------------------------------------------------------------------------------+
| fernbox-daemon (Trust Root — NO V8 linked or initialized)                              |
|  - Owns ~/.fernbox/{daemon.json, images/, volumes/} & per-name VolumeLocks/ImageLock   |
|  - Enforces FsPolicy (64 MiB seed, 16 MiB volume) & NetPolicy (VirtualResolver + IP)   |
|  - Binds loopback HTTP gate (`--publish`) and enforces hard kill timeout (+10s SLACK)  |
+----------------------------------------------------------------------------------------+
            |                                                      ^
            | Stdin: WorkerRun (seed, limits)                      | Stdout: WorkerMessage
            |        DaemonMessage (FetchResult, HttpRequest)      |  (Fetch, HttpResponse, Done)
            v                                                      |
+----------------------------------------------------------------------------------------+
| fernbox-worker (Ephemeral Per-Run Process — Windows Job + Restricted Low-Integrity)    |
|  +----------------------------------------------------------------------------------+  |
|  | Single V8 Isolate (`Limited`: max_heap + near_heap_limit + Watchdog Thread)      |  |
|  |                                                                                  |  |
|  |  +-----------------------------------+    Rust Primitive    +-----------------+  |  |
|  |  | System V8 Context (`virtual_os`)  | <== String Bridge == | User V8 Context |  |  |
|  |  |  - memfs + unionfs + linkfs       |    (`call_system`)   |  - Frozen API   |  |  |
|  |  |  - readOnly Proxy on base image   |                      |  - Node shims   |  |  |
|  |  |  - `/etc/hosts` + snapshot()      |                      |  - Untrusted JS |  |  |
|  |  +-----------------------------------+                      +-----------------+  |  |
|  +----------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------+
```

### 2.1 Boundary B1: Client-to-Daemon Control Plane
* **Loopback-Only Binding:** `fernbox-daemon` binds exclusively to `127.0.0.1` (`crates/daemon/src/serve.rs:64`), rejecting external network interfaces at the socket layer.
* **256-Bit Capability Token & Constant-Time Verification:** On startup, the daemon generates 32 random bytes from `OsRng`, writes `~/.fernbox/daemon.json`, and verifies `AuthenticatedRequest.token` in constant time without early length-mismatch returns (`crates/daemon/src/serve.rs:193-204`).
* **Strict Wire Deserialization:** Every protocol struct in `crates/proto/src/lib.rs` (`AuthenticatedRequest`, `ClientRequest`, `WorkerRun`, `WorkerMessage`, `DaemonMessage`) carries `#[serde(deny_unknown_fields)]`, rejecting unexpected fields at parse time.

### 2.2 Boundary B2: Daemon-to-Worker Process Split
* **Zero V8 Surface in the Trust Root:** `fernbox-daemon` never initializes V8. Each `Run` spawns a fresh `fernbox-worker` process that exits immediately after returning `WorkerMessage::Done`, eliminating cross-run heap residue.
* **No Secrets on the Command Line:** Seeds, scripts, environment variables, and volume contents pass exclusively over piped `stdin` (`crates/daemon/src/spawn/win.rs:21-23`), keeping `ps` and `tasklist` clean.
* **Policy Authority Retained in Daemon:** Workers have no `NetPolicy` authority; outbound fetches emit `WorkerMessage::Fetch` over `stdout`, forcing the daemon to evaluate `gated_fetch` (`crates/daemon/src/worker.rs:163-191`).
* **Windows Process Containment:** `crates/daemon/src/spawn/win.rs:134-213` spawns workers via `CreateProcessAsUserW` inside a Win32 Job Object (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS`, `ActiveProcessLimit = 1`), with a `DISABLE_MAX_PRIVILEGE` restricted token, `S-1-16-4096` Low Mandatory Integrity label, and an explicit `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` containing only `stdin`, `stdout`, and `stderr`.

### 2.3 Boundary B3: Two-Context V8 Isolate & Primitive-Only Bridge
* **Separate V8 Realms:** `Vm::new` (`crates/core/src/vm.rs:133-209`) constructs two distinct `v8::Context` instances inside one `Limited` isolate: a **System Context** hosting `virtual_os.js` (`memfs`, `unionfs`, `linkfs`) and a **User Context** hosting `user_runtime.js` and untrusted guest code. Each context has completely disjoint `Object.prototype`, `Function`, and `Error` intrinsics.
* **Primitive-Only Cross-Realm Marshalling (`call_system`):** Historically, JavaScript sandboxes such as `vm2` failed because host-realm objects or exceptions leaked across realm boundaries, allowing `.constructor.constructor("return process")()`. FernBox's `call_system` (`crates/core/src/vm.rs:1147-1169`) enforces a strict Rust-mediated invariant: arguments cross from User Context to Rust `String`/`&str`, are re-allocated as fresh `v8::String`s inside the System Context, and return values/errors are converted back to Rust `String`s before entering the User Context. No `v8::Object`, `v8::Function`, or `v8::Value` handle is ever shared between contexts.
* **Frozen Surface & Canary Verification:** `globalThis.fernbox` and its nested namespaces (`fs`, `http`, `stdio`) are sealed with `Object.freeze` (`runtime/src/user/index.js:49-65`), and `fixtures/escape_probe.js` + `fixtures/escape_canary.js` continuously test prototype chains, exception constructors, timer callbacks, and heap/stack reflection against `globalThis.__fernbox_secret`.

### 2.4 Boundary B4: Virtual Filesystem & State Persistence
* **Layered Union Filesystem:** `runtime/src/index.js:27-68` mounts the base image through a `readOnly` `Proxy` that throws `EROFS` on mutating `fs` operations (`MUTATING` set), overlays mounted volumes (`Volume.fromJSON`), and tops the union with an ephemeral `writable` `Volume` (redirecting `/tmp` and `/var/tmp` via `linkfs`).
* **Symlink-Free Host Ingestion & Deterministic Locking:** `load_file_map` (`crates/daemon/src/state.rs:425-464`) ingests regular UTF-8 files only and explicitly ignores symlinks so an app folder cannot pull arbitrary host files into a seed. `Daemon::lock_volumes` (`crates/daemon/src/state.rs:275-284`) deduplicates and lexicographically sorts volume names to prevent AB-BA deadlocks across concurrent runs.

### 2.5 Boundary B5: Virtual DNS & Egress Network Gate
* **Offline-by-Default Virtual DNS:** `VirtualResolver` (`crates/core/src/net.rs:202-249`) never queries the host OS resolver. Hostnames resolve solely against the sandbox's live `/etc/hosts` (capped at `MAX_HOSTS_LINES = 4096`), preventing internal DNS reconnaissance and DNS-rebinding TOCTOU between resolution and connection.
* **Per-Hop Redirect Policy Enforcement:** Because policy lives inside `ureq`'s `Resolver` implementation (`crates/core/src/net.rs:223-229`), every HTTP redirect hop re-runs `NetPolicy::check` on the resolved `IpAddr` (including IPv4-mapped `::ffff:a.b.c.d` and IPv4-compatible `::a.b.c.d` addresses in `crates/core/src/net.rs:148-165`), blocking link-local metadata (`169.254.0.0/16`, `fe80::/10`), loopback (`127.0.0.0/8`, `0.0.0.0/8`, `::1`, `::`), and RFC 1918 / RFC 4193 private space by default.

---

## 3. Codebase Security Audit Findings

The table below summarizes all verified vulnerabilities and defense-in-depth weaknesses identified during the line-by-line audit of `v0.1.0`.

| ID | Severity | Component | Summary |
| :--- | :--- | :--- | :--- |
| **FBX-001** | **Critical** | `runtime/src/index.js`, `crates/daemon/src/main.rs` | Unnormalized volume prefix check + unvalidated daemon snapshot keys allow persistent root/image poisoning via `fernbox.write` |
| **FBX-002** | **High** | `crates/daemon/src/spawn/posix.rs` | POSIX worker spawn applies zero OS sandboxing, FD scrubbing, or `rlimit` bounds |
| **FBX-003** | **High** | `runtime/images/base/bin/npm.js` | Tar-Slip path traversal and unbounded gzip decompression in bundled `npm` client |
| **FBX-004** | **High** | `crates/core/Cargo.toml` | Massively outdated V8 engine (`rusty_v8 = 0.32.1`, ~2021 V8 9.x) with years of known JIT/runtime CVEs |
| **FBX-005** | **High** | `crates/daemon/src/serve.rs`, `crates/daemon/src/frame.rs` | Unauthenticated control-socket connections can allocate 96 MiB frames and hold unbounded tasks |
| **FBX-006** | **Medium** | `crates/core/src/vm.rs`, `crates/core/src/isolate.rs` | Unbounded native Rust heap growth (`stdout`, `stderr`, `responses`) and `near_heap_limit` +16 MiB ratchet bypass memory limits |
| **FBX-007** | **Medium** | `crates/core/src/net.rs` | Incomplete special-use IPv4/IPv6 classification permits SSRF to CGNAT (`100.64/10`), NAT64 (`64:ff9b::/96`), 6to4 (`2002::/16`), benchmarking, and multicast ranges |
| **FBX-008** | **Medium** | `crates/daemon/src/gate.rs`, `runtime/src/user/builtins/http.js` | Loopback HTTP gate vulnerable to Slowloris socket starvation, premature deadline renewal, `Content-Length` smuggling ambiguity, and CRLF header injection |
| **FBX-009** | **Medium** | `crates/daemon/src/serve.rs`, `crates/daemon/src/spawn/win.rs` | Host secret exposure: Unix `daemon.json` chmod TOCTOU, worker inherits full daemon environment block, and Windows Low-Integrity failure degrades silently |
| **FBX-010** | **Medium** | `crates/daemon/src/main.rs`, `crates/daemon/src/state.rs` | State concurrency races: unlocked `VolumeFiles`/`Images` reads against non-atomic writes, and `commit_volume` locks `from` in the wrong lock map |
| **FBX-011** | **Low** | `crates/core/src/vm.rs` | System-context JS source interpolation of `seed.image` and `seed.volumes` instead of `v8::json::parse` |
| **FBX-012** | **Low** | `crates/daemon/src/worker.rs` | Daemon trusts worker-reported `budget_ms` for outbound HTTP fetch timeouts |
| **FBX-013** | **Low** | `crates/core/src/vm.rs` | Dynamic lookup of mutable user-realm `globalThis.JSON.stringify` in `arg_options` |
| **FBX-014** | **Low** | `crates/daemon/src/state.rs` | Unbounded growth of in-memory `volumes` and `images` lock `HashMap`s across distinct names |

---

### Detailed Findings & Remediations (FBX-001 through FBX-007)

#### FBX-001 (Critical): Persistent Volume Mount Escape & Base-Image Poisoning
* **Locations:** `runtime/src/index.js:93-97`, `runtime/src/index.js:126-139`, `runtime/src/index.js:333-339`, `crates/daemon/src/main.rs:567-582`, `crates/daemon/src/state.rs:136-144`
* **Mechanism:** While the Node-compatible `fs` shim normalizes paths via `path.resolve` before calling `fernbox.fs.*`, the raw primitive `fernbox.write(target, data)` exposed directly on `globalThis.fernbox` (`crates/core/src/vm.rs:547`) passes `target` unnormalized to `__fernbox.write` (`runtime/src/index.js:93`). Inside `layerFor(target)` (`runtime/src/index.js:126-139`):
  1. `volumeFor(target)` checks `target === v.mount || target.startsWith(v.mount + "/")` on the raw string. An input with dot-segments under a mounted volume (e.g., starting with `/data/../` when `data:/data` is mounted) matches the `/data` volume before `memfs` normalizes `..`.
  2. Each volume's `memfs` `Volume` is mounted at `/` inside `unionfs` (`runtime/src/index.js:49-51`), so `layer.writeFileSync(resolved, data)` normalizes the path inside `memfs` and writes to arbitrary virtual paths outside `/data` (such as `/etc/hosts`, `/main.js`, or `/bin/*`).
  3. On run completion, `__fernbox.snapshot()` (`runtime/src/index.js:335`) calls `v.layer.toJSON()`, emitting keys outside `v.mount`.
  4. In the trust root, `snapshot_volumes` (`crates/daemon/src/main.rs:567-582`) deserializes `FileMap` from the untrusted worker's `WorkerMessage::Done` and writes it straight to `~/.fernbox/volumes/<name>.json` with **zero validation** that keys are normalized or confined under `volume.mount` (nor even rejecting `..` keys from a compromised worker). If the volume is later passed to `commit_volume` (`crates/daemon/src/state.rs:136-144`), `commit_volume` only checks `starts_with('/')` and `..`, allowing the volume to overwrite `/etc/hosts`, `/bin/*`, or any file in the resulting committed image.
* **Impact:** Any untrusted script running with a mounted volume can escape its mount prefix, overwrite `/etc/hosts` or `/bin/*` inside the persistent volume, poison every future run that mounts that volume, and backdoor images created via `fernbox commit`. A compromised worker can additionally persist keys containing `..` into `volumes/<name>.json`.
* **Remediation:**
  1. **System Runtime (`runtime/src/index.js`):** Normalize every `target` path using POSIX canonicalization (`posixNormalize` collapsing `.`, `..`, duplicate slashes, and enforcing leading `/`) *before* `volumeFor(target)`, `resolveRedirect(target)`, or any `ufs`/`layer` operation in `read`, `write`, `list`, and all `fs` entrypoints.
  2. **Daemon Trust Root (`crates/daemon/src/main.rs:567` & `crates/daemon/src/state.rs:93`):** Enforce mount confinement on the daemon side before accepting any worker snapshot: every key in `files` MUST start with `/`, contain no empty/`..`/`.` segments or NUL/backslashes, and equal `mount` or start with `format!("{mount}/")` (normalized). Reject the entire snapshot on any violation. Apply the same canonical path validator in `commit_volume`.

#### FBX-002 (High): Unsandboxed Worker Process on POSIX Hosts
* **Location:** `crates/daemon/src/spawn/posix.rs:20-30`
* **Mechanism:** Unlike `spawn/win.rs`, `spawn/posix.rs` launches `fernbox-worker` via a bare `std::process::Command::new(exe)`. No Linux namespaces (`CLONE_NEWNS`, `CLONE_NEWNET`, `CLONE_NEWPID`, `CLONE_NEWIPC`, `CLONE_NEWUSER`), `seccomp-bpf` syscall filter, Landlock/chroot filesystem jail, `PR_SET_NO_NEW_PRIVS`, `setrlimit` (`RLIMIT_AS`, `RLIMIT_NPROC`, `RLIMIT_FSIZE`, `RLIMIT_NOFILE`), credential drop, or non-standard file-descriptor scrub is applied, and `WorkerChild::Drop` is not implemented to guarantee `SIGKILL` on early drop.
* **Impact:** On Linux/macOS, a V8 escape (Adversary A4) immediately grants full access to the daemon user's `~/.fernbox/daemon.json` token, host filesystem, local network sockets, and arbitrary subprocess execution.
* **Remediation:**
  1. Scrub inherited file descriptors > 2 (`close_range` / `FD_CLOEXEC` audit) and clear ambient environment variables (`Command::env_clear()`).
  2. Set `PR_SET_NO_NEW_PRIVS`, `RLIMIT_NPROC = 0` (or minimal thread allowance), `RLIMIT_NOFILE`, `RLIMIT_FSIZE = 0`, and `RLIMIT_CORE = 0` in `pre_exec`.
  3. Enforce `Landlock` (or unprivileged mount/network/PID/IPC user namespaces via `unshare`/`bwrap`) + a strict `seccomp-bpf` allowlist permitting only memory management, futex/threads for V8, `read`/`write` on stdio pipes, and `exit_group`.
  4. Refuse to start `fernbox-daemon` on POSIX without `--insecure-no-os-sandbox` until OS isolation is active, and implement `Drop` on POSIX `WorkerChild` to `SIGKILL` + reap.

#### FBX-003 (High): Tar-Slip Path Traversal & Unbounded Gzip Bomb in Bundled `npm.js`
* **Locations:** `runtime/images/base/bin/npm.js:238-261`, `runtime/images/base/bin/npm.js:61-82`
* **Mechanism:**
  1. `installOne` decompresses registry tarballs with `gunzipSync(gzip)` (`npm.js:239`) without bounding decompressed output size; a 16 MiB compressed payload (`NetPolicy::max_body_bytes`) can expand to gigabytes in V8/typed-array memory.
  2. For each tar entry starting with `"package/"`, `npm.js:250-258` computes `const root = path.join("/node_modules", parsed.name)` and `const dest = path.join(root, relative)` and immediately writes `fs.writeFileSync(dest, text)` without verifying that `dest` remains inside `root + "/"` (nor validating `parsed.name` against `..` traversal in scoped package names).
* **Impact:** Installing a package from an untrusted or compromised registry/mirror allows arbitrary virtual file overwrite (`/etc/hosts`, `/main.js`, `/bin/*`, or mounted persistent `/data/*` volumes) and trivial OOM crashes.
* **Remediation:** Validate `parsed.name` against strict npm package-name rules (no `..` segments), resolve `const cleanRoot = path.resolve("/node_modules", parsed.name)` and `const dest = path.resolve(cleanRoot, relative)`, reject any entry where `!dest.startsWith(cleanRoot + "/")`, reject symlink/hardlink tar typeflags (`'2'`, `'1'`), and replace `gunzipSync` with streaming `Gunzip` enforcing a strict decompressed byte ceiling (e.g., 32 MiB).

#### FBX-004 (High): Outdated V8 Engine (`rusty_v8 = 0.32.1`)
* **Location:** `crates/core/Cargo.toml:8`
* **Mechanism:** `fernbox-core` pins `rusty_v8 = "0.32.1"` (circa 2021 V8 9.x). Hundreds of publicly disclosed V8 type-confusion, TurboFan/Maglev JIT optimization, and WebAssembly memory-corruption CVEs with public proof-of-concept exploits affect this V8 generation.
* **Impact:** Untrusted guest JavaScript (Adversary A1) can reliably escalate to Adversary A4 (native code execution inside `fernbox-worker`), placing full pressure on OS-level worker containment (which is currently absent on POSIX per FBX-002).
* **Remediation:**
  1. Migrate `fernbox-core` from deprecated `rusty_v8` to actively maintained `v8` crate releases tracking current Chromium stable/extended-stable V8 branches.
  2. Enable V8's "--jitless" mode (`v8::V8::set_flags_from_string("--jitless --no-expose-wasm")` or per-run policy toggle) by default for untrusted workloads that do not require peak JIT throughput, eliminating the entire JIT compiler and Wasm codegen attack surface.

#### FBX-005 (High): Pre-Authentication Control-Socket Memory & Connection DoS
* **Locations:** `crates/daemon/src/serve.rs:107-155`, `crates/daemon/src/frame.rs:26-47`, `crates/proto/src/lib.rs:33`
* **Mechanism:** `serve()` (`serve.rs:107-118`) accepts loopback TCP connections in an unbounded loop and spawns a Tokio task per connection with no concurrency limit and no read timeout. Inside `serve_connection` (`serve.rs:133`), `read_frame_async` (`frame.rs:26-47`) reads a caller-controlled 4-byte length up to `MAX_FRAME_BYTES` (96 MiB) and executes `let mut payload = vec![0u8; len];` *before* authenticating `AuthenticatedRequest.token` (`serve.rs:141`) and *before* acquiring the `slots` semaphore (`serve.rs:152`).
* **Impact:** Any unprivileged local process on the host (Adversary A3) can open dozens of loopback connections, send `[0x00, 0x06, 0x00, 0x00]` (96 MiB) + 1 byte, and stall—exhausting gigabytes of daemon RAM and crashing the trust root without knowing the auth token.
* **Remediation:**
  1. Bound total concurrent control connections with an `Arc<Semaphore>` (e.g., 64 connections) and apply a strict pre-auth read timeout (`tokio::time::timeout(Duration::from_secs(5), ...)`).
  2. Split authentication into a tiny initial handshake frame (capped at e.g. 256 bytes) verified *before* permitting large `MAX_FRAME_BYTES` `Run` payloads, or stream-read with bounded chunk growth only on authenticated sessions.

#### FBX-006 (Medium): Unbounded Native Heap Allocations & `near_heap_limit` Ratchet
* **Locations:** `crates/core/src/vm.rs:761-777`, `crates/core/src/vm.rs:1005-1022`, `crates/core/src/isolate.rs:48-57`
* **Mechanism:**
  1. `stdio_write` (`vm.rs:774-777`) appends directly to Rust `String`s (`state.stdout.push_str(&text)` and `state.stderr.push_str(&text)`) outside the V8 heap. A tight loop writing a reused 1 MiB V8 string to `process.stdout.write` consumes gigabytes of native worker memory while keeping V8 heap usage flat, and then ships the oversized `WorkerMessage::Done` buffer back to the daemon.
  2. `http_respond` (`vm.rs:1022`) similarly pushes `(id, raw_b64)` onto `state.responses` without per-turn count or cumulative byte caps.
  3. `near_heap_limit` (`isolate.rs:48-57`) unconditionally returns `current_heap_limit + 16 * 1024 * 1024` every time V8 invokes it. If native host callbacks or C++ allocations continue re-triggering the callback before unwinding completes, the heap ceiling ratchets upward by 16 MiB per invocation; on Windows (`spawn/win.rs:285-286`), `ProcessMemoryLimit` and `JobMemoryLimit` on the Job Object are set to `0` (unlimited).
* **Impact:** Guest scripts can bypass `--memory` (`memory_limit_mb`) and trigger host OOM kills of `fernbox-worker` or starve the daemon.
* **Remediation:**
  1. Cap `state.stdout` and `state.stderr` (e.g., 8 MiB each, setting a `truncated` flag thereafter) and bound `state.responses` bytes per event-loop turn.
  2. In `near_heap_limit`, grant the +16 MiB unwind slack **at most once** (checking `signal.oom.swap(true, Ordering::SeqCst)` against `_initial_heap_limit`).
  3. Set hard OS-level virtual memory ceilings (`JOB_OBJECT_LIMIT_PROCESS_MEMORY` on Windows; `RLIMIT_AS` / cgroup v2 `memory.max` on Linux) to `memory_limit_mb + overhead`.

#### FBX-007 (Medium): Incomplete Special-Use IPv4/IPv6 Classification in `NetPolicy`
* **Locations:** `crates/core/src/net.rs:117-165`
* **Mechanism:** `classify_v4` and `classify_v6` treat any address not matching a short denylist as `IpClass::Public`. As a result, the following non-public/special-use IANA ranges are misclassified as `IpClass::Public` even when `allow_loopback = false` and `allow_private = false`:
  * **IPv4:** `100.64.0.0/10` (RFC 6598 Carrier-Grade NAT — heavily used by Tailscale, WireGuard meshes, Kubernetes pods, and cloud internal fabrics), `198.18.0.0/15` (RFC 2544 benchmarking), `192.0.0.0/24` (IANA special-purpose), `224.0.0.0/4` (multicast), `240.0.0.0/4` (reserved), and `255.255.255.255/32` (broadcast).
  * **IPv6:** `64:ff9b::/96` and `64:ff9b:1::/48` (RFC 6052/8215 NAT64 translation, which can wrap private/metadata IPv4 targets if a NAT64 gateway is present on the host network), `2002::/16` (6to4 embedding IPv4 in segments `s[1..=2]`), `2001::/32` (Teredo), `ff00::/8` (multicast), and `100::/64` (discard prefix).
* **Impact:** Guest scripts that write custom mappings into `/etc/hosts` (or use IP literals) can reach internal CGNAT overlays (e.g., Tailscale `100.x.y.z` services on the host) or NAT64 gateways despite `allow_private: false`.
* **Remediation:** Invert `classify` to a strict global-unicast allowlist (matching Rust's `Ipv4Addr::is_global` / IANA Special-Purpose Address Registry RFC 6890), classifying `100.64.0.0/10` under `IpClass::Private`, extracting embedded IPv4 addresses from `64:ff9b::/96` and `2002::/16`, and unconditionally denying multicast, broadcast, benchmarking, Teredo, and reserved blocks.

### Detailed Findings & Remediations (FBX-008 through FBX-014)

#### FBX-008 (Medium): Loopback HTTP Gate Slowloris DoS, Premature Renewal & HTTP Smuggling/CRLF
* **Locations:** `crates/daemon/src/gate.rs:142-227`, `crates/daemon/src/gate.rs:234-300`, `runtime/src/user/builtins/http.js:501-513`
* **Mechanism:**
  1. **Slowloris Starvation & Premature Renewal:** `Gate::accept` (`gate.rs:162-178`) caps concurrent threads at `MAX_CONNECTIONS = 64` (`gate.rs:142`), calls `shared.renew()` (`gate.rs:166`) *before* reading a single byte, and enters synchronous `read_request(&mut stream)` (`gate.rs:234`) with **no `TcpStream::set_read_timeout`**. Opening 64 idle TCP sockets permanently holds all 64 gate permits so every legitimate caller receives `503 Service Unavailable`, while staggered idle connections artificially extend run lifetime up to `DEFAULT_MAX_LIFE_MS` (1 hour).
  2. **`Content-Length` / `Transfer-Encoding` Ambiguity:** `read_request` (`gate.rs:265-274`) iterates headers, overwrites `content_length` on duplicate `Content-Length` headers, silently maps invalid `Content-Length` strings to `0` (`unwrap_or(0)`), and ignores `Transfer-Encoding: chunked`, enabling request-boundary desynchronization if placed behind a reverse proxy.
  3. **Outbound Response Splitting / Unvalidated Raw Wire Bytes:** `serialize(res)` in `runtime/src/user/builtins/http.js:501-513` interpolates `res.statusMessage` and header names/values into raw HTTP/1.1 lines without stripping `\r` or `\n`, and `gate.rs:219` writes worker-supplied `raw_b64` bytes directly onto the TCP socket without framing validation.
* **Remediation:**
  1. Set `stream.set_read_timeout(Some(Duration::from_secs(5)))` and `set_write_timeout` immediately on accepted sockets, and invoke `shared.renew()` only *after* a valid HTTP request has been completely parsed.
  2. Reject requests containing `Transfer-Encoding`, multiple `Content-Length` headers, or unparseable `Content-Length` values with `400 Bad Request`.
  3. Strip or reject `\r` and `\n` in `statusMessage`, header names, and header values in `http.js`, and pass structured `(status, headers, body)` over `WorkerMessage::HttpResponse` so the trusted daemon serializes the HTTP/1.1 wire response.

#### FBX-009 (Medium): Host Secret Exposure (`daemon.json` TOCTOU, Inherited Worker Env, Degraded Low-Integrity)
* **Locations:** `crates/daemon/src/serve.rs:227-241`, `crates/daemon/src/spawn/win.rs:176-189`, `crates/daemon/src/spawn/win.rs:353-361`, `crates/daemon/src/spawn/posix.rs:21-26`
* **Mechanism:**
  1. **Unix `daemon.json` TOCTOU:** `write_daemon_info` (`serve.rs:227-241`) calls `std::fs::write(&path, json)`—creating `daemon.json` under the process's default `umask` (typically `0644` world-readable)—and only subsequently calls `permissions.set_mode(0o600)`. A local user polling `~/.fernbox` on daemon startup can read the 256-bit capability token during the race window.
  2. **Inherited Host Environment Block:** Both `CreateProcessAsUserW` (`spawn/win.rs:185`, passing `lpEnvironment = null`) and `Command::new` (`spawn/posix.rs:21`) pass the daemon's full host OS environment block (`AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`, `SSH_AUTH_SOCK`, etc.) into `fernbox-worker` process memory. While guest JS only sees `seed.env`, a V8 escape (Adversary A4) or crash dump immediately exposes every secret in the daemon's environment.
  3. **Silent Windows Integrity Fallback:** If `lower_integrity(restricted)` fails (`spawn/win.rs:353-361`), `restricted_token` logs a one-time stderr warning and still spawns the worker at the daemon's Medium/High integrity level, granting write access to the user's profile directory upon V8 escape.
* **Remediation:**
  1. On Unix, create `~/.fernbox` with mode `0o700` and open `daemon.json.tmp` via `OpenOptions::new().write(true).create_new(true).mode(0o600)` before writing the token and atomically renaming to `daemon.json`. On Windows, restrict `~/.fernbox` DACLs to the current user SID and `SYSTEM`.
  2. Pass an explicit minimal environment block (`SystemRoot` / `PATH` only) to `CreateProcessAsUserW` and `Command::env_clear()` on POSIX.
  3. Fail closed when `lower_integrity` fails unless an explicit `--allow-degraded-sandbox` flag is set on the daemon.

#### FBX-010 (Medium): State Directory Concurrency & Lock-Map Bugs
* **Locations:** `crates/daemon/src/main.rs:328-339`, `crates/daemon/src/main.rs:608-626`, `crates/daemon/src/state.rs:110-116`, `crates/daemon/src/state.rs:231-235`
* **Mechanism:**
  1. `crates/daemon/src/state.rs:231-235` explicitly documents the safety invariant that *every* read and write of a volume or image MUST acquire `lock_volumes` or `lock_image` because `write_volume` (`state.rs:115`) truncates files in place (`std::fs::write`). However, `ClientRequest::Images`, `Volumes`, and `VolumeFiles` in `crates/daemon/src/main.rs:328-339` call `list_images()`, `list_volumes()`, and `volume_entries(&volume)` **without acquiring any lock**, allowing concurrent runs to cause partial-JSON read failures.
  2. In `commit_volume` (`crates/daemon/src/main.rs:612`), the daemon executes `daemon.lock_volumes(&[volume.to_string(), from.to_string()])` and `daemon.lock_image(image)`. Because `from` is the source *image* name—not a volume name—locking `from` inside `daemon.volumes` instead of `daemon.images` fails to synchronize against a concurrent `commit_volume` mutating image `from`.
* **Remediation:**
  1. Acquire `daemon.lock_volumes(&[volume])` inside `ClientRequest::VolumeFiles`, and lock both `from` and `image` (in sorted order to avoid deadlock) via `daemon.images` during `commit_volume`.
  2. Make `write_volume` crash- and reader-atomic by writing to `volumes/<name>.json.tmp.<nonce>`, `sync_all()`, and `std::fs::rename` over `volumes/<name>.json`.

#### FBX-011 (Low): System-Context JS Source Interpolation of Seed JSON
* **Location:** `crates/core/src/vm.rs:159-168`
* **Mechanism:** `Vm::new` injects `seed.image` and `seed.volumes` into the privileged System V8 Context by formatting JavaScript source code (`format!("globalThis.__fernbox_image = {};", seed.image)`) and compiling it with `run_script_in` instead of parsing data via `v8::json::parse`. Although `compose_seed` currently produces `serde_json` strings, any caller of `fernbox_core::Vm::new` (such as N-API consumers or tests) passing unvalidated strings into `InstanceSeed` achieves arbitrary code execution in the System Context.
* **Remediation:** Pass `seed.image` and `seed.volumes` as `v8::String`s and deserialize them with `v8::json::parse(scope, json_str)` before assigning properties on `context.global(scope)` via `set`.

#### FBX-012 (Low): Daemon Trusts Worker-Reported `budget_ms` on Outbound Fetches
* **Location:** `crates/daemon/src/worker.rs:170-175`
* **Mechanism:** When handling `WorkerMessage::Fetch { budget_ms, .. }`, `answer_fetch` passes `Duration::from_millis(budget_ms)` directly to `gated_fetch`. A compromised worker can send `u64::MAX` to keep `gated_fetch` open up to `policy.request_timeout` even when the run's actual deadline has almost expired (bounded only by the daemon's outer `deadline + SLACK` kill timer).
* **Remediation:** Compute remaining budget solely from the daemon's authoritative `*self.shared.deadline.lock().unwrap()` (`deadline.saturating_duration_since(Instant::now())`) and remove `budget_ms` trust on the daemon side.

#### FBX-013 (Low): Mutable User-Realm `JSON.stringify` Lookup in `arg_options`
* **Location:** `crates/core/src/vm.rs:1104-1139`
* **Mechanism:** `arg_options` looks up `"JSON"` and `"stringify"` dynamically on the user context's mutable `globalThis` when marshalling options objects for `fs` callbacks. User code can replace `globalThis.JSON.stringify` or install getters. Because the return value is converted to a Rust `String` (`to_rust_string_lossy`) and re-parsed in the System Context, this does not leak cross-realm object references, but it creates unnecessary re-entrancy into user JS during host callback argument extraction.
* **Remediation:** Use `v8::json::stringify(scope, val)` directly from the C++/Rust V8 API rather than looking up mutable user-realm `globalThis.JSON.stringify`.

#### FBX-014 (Low): Unbounded Lock-Table Growth Across Distinct Volume/Image Names
* **Location:** `crates/daemon/src/state.rs:236-248`, `crates/daemon/src/state.rs:289-292`
* **Mechanism:** `Daemon::mutex_for` inserts an `Arc<Mutex<()>>` per distinct volume or image name and never evicts unused entries (`Arc::strong_count == 1`). Authenticated callers generating millions of ephemeral names grow the lock maps linearly over daemon uptime.
* **Remediation:** Prune map entries whose `Arc::strong_count(&entry) == 1` opportunistically during `mutex_for` when table length exceeds a threshold (e.g., 4,096 entries).

---

## 4. Mandatory Security Invariants

Every pull request modifying `crates/core`, `crates/daemon`, `crates/worker`, `crates/proto`, or `runtime/` MUST uphold these seven invariants:

1. **Invariant I1 — Primitive-Only V8 Context Bridge:** No `v8::Object`, `v8::Array`, `v8::Function`, `v8::Promise`, or exception object allocated in the System Context may ever be passed into the User Context, and vice versa. Every boundary crossing MUST marshal through Rust-owned bytes/strings (`call_system` in `crates/core/src/vm.rs:1147`) or `v8::json::stringify` / `v8::json::parse`.
2. **Invariant I2 — Dual-Layer Canonical Path Confinement:** Both `runtime/src/index.js` (before selecting a `unionfs` or volume layer) and `crates/daemon` (before persisting a worker snapshot or committing an image) MUST canonicalize virtual paths and enforce that volume writes start with `<mount>/` (or equal `<mount>`), contain no `.` or `..` segments, and contain no NUL or `\` characters.
3. **Invariant I3 — Trust Root Isolation (`fernbox-daemon`):** `fernbox-daemon` MUST never link or initialize V8, evaluate JavaScript, or trust worker-reported limits, paths, or raw wire frames without independent validation against `FsPolicy`, `NetPolicy`, and authoritative daemon deadlines.
4. **Invariant I4 — Pre-Authentication Constant Memory & Time:** No network listener (`serve.rs` or `gate.rs`) may allocate buffers proportional to untrusted frame headers prior to authentication, nor perform blocking socket reads without an explicit socket/task timeout and concurrency semaphore.
5. **Invariant I5 — Virtual-Only Name Resolution & Default-Deny IP Classification:** Outbound network connections MUST resolve hostnames exclusively via per-instance virtual `/etc/hosts` (never host DNS) and MUST re-verify every redirect hop against a default-deny `IpClass` allowlist that permits only globally routable unicast addresses unless explicitly opted in.
6. **Invariant I6 — Zero Ambient Host Leakage to Workers:** `fernbox-worker` MUST spawn with an empty/minimal environment block, zero inherited file descriptors/handles beyond `stdin`/`stdout`/`stderr`, stripped OS privileges, and hard OS-enforced process count and virtual-memory ceilings.
7. **Invariant I7 — Atomic & Locked Persistent State:** Every read and write of `~/.fernbox/volumes` and `~/.fernbox/images` MUST hold the corresponding sorted `VolumeLocks` or `ImageLock` guard, and mutations MUST use write-temp-fsync-rename atomicity.

---

## 5. Prioritized Hardening Roadmap

### Phase P0 — Immediate Blockers (Before Any Untrusted Multi-Run Deployment)
* **[FBX-001]** Canonicalize paths in `runtime/src/index.js` prior to `volumeFor` and enforce strict mount-prefix containment in `crates/daemon/src/main.rs:snapshot_volumes` and `state.rs:commit_volume`.
* **[FBX-003]** Enforce `path.resolve` root containment, symlink entry rejection, and bounded streaming gzip decompression in `runtime/images/base/bin/npm.js`.
* **[FBX-005]** Cap concurrent connections, add a 5s pre-auth timeout, and restrict pre-authentication frame allocation to <= 1 KiB in `crates/daemon/src/serve.rs` and `frame.rs`.
* **[FBX-011 & FBX-013]** Replace JS source interpolation of `seed.image`/`seed.volumes` with `v8::json::parse` and replace dynamic `JSON.stringify` lookup with `v8::json::stringify` in `crates/core/src/vm.rs`.

### Phase P1 — High-Priority Runtime & OS Containment
* **[FBX-004]** Upgrade `rusty_v8` (`0.32.1`) to a current `v8` crate release and add `--jitless --no-expose-wasm` as the hardened default execution profile.
* **[FBX-002 & FBX-009]** Implement Linux `seccomp-bpf` + `Landlock`/namespaces + `rlimit` + FD scrubbing in `spawn/posix.rs`; scrub worker `env` on all platforms; fix `daemon.json` `0o600` creation atomicity; fail closed on Windows `lower_integrity` errors.
* **[FBX-006]** Bound `stdout`, `stderr`, and `responses` buffers in `VmState`, make `near_heap_limit` single-shot, and enforce OS memory caps (`JOB_OBJECT_LIMIT_PROCESS_MEMORY` / `RLIMIT_AS`).

### Phase P2 — Network, Gate & State Hardening
* **[FBX-007]** Expand `crates/core/src/net.rs:classify` to cover RFC 6598 CGNAT (`100.64.0.0/10`), NAT64 (`64:ff9b::/96`), 6to4 (`2002::/16`), Teredo, benchmarking, multicast, and reserved IANA ranges.
* **[FBX-008 & FBX-012]** Add read/write timeouts, post-parse deadline renewal, strict `Content-Length`/`Transfer-Encoding` rejection, and daemon-side HTTP response serialization in `gate.rs`; enforce daemon-side fetch budget clamping in `worker.rs`.
* **[FBX-010 & FBX-014]** Add missing read/image locks in `crates/daemon/src/main.rs`, switch `write_volume` to atomic rename, and prune idle lock-map entries in `state.rs`.

---

## 6. Security Regression Test Suite & CI Verification Plan

Existing escape fixtures (`fixtures/escape_probe.js` and `fixtures/escape_canary.js`, driven by `crates/worker/src/probe.rs`) validate V8 realm separation. The CI pipeline (currently `.github/workflows/benchmark.yml` only) MUST add a dedicated `.github/workflows/security.yml` workflow gating every PR on Windows and Linux with the following tests:

| Test Suite | Target Finding / Invariant | Verification Assertion |
| :--- | :--- | :--- |
| `escape_probe` & `escape_canary` | **I1** (Two-Context Bridge) | All prototype, constructor, error, timer, and stack-canary probes report `PASS` and never read `SYSTEM_CONTEXT_CANARY`. |
| `volume_mount_confinement` | **FBX-001 / I2** | `fernbox.write` with dot-segment paths under a mounted volume cannot write outside `mount` or persist out-of-mount keys in `volumes/<name>.json`, and synthetic worker `Done` frames with out-of-mount keys are rejected by `snapshot_volumes`. |
| `npm_tarslip_and_bomb` | **FBX-003** | Tarballs containing `package/../../etc/hosts`, symlink entries, or >32 MiB decompressed streams fail cleanly without mutating `/etc/hosts` or exhausting memory. |
| `control_preauth_limits` | **FBX-005 / I4** | Unauthenticated TCP clients sending oversized length prefixes or stalling are disconnected within timeout without >1 KiB allocation. |
| `native_buffer_caps` | **FBX-006** | Tight `process.stdout.write` and `http_respond` loops hit deterministic truncation/error bounds well below OS memory limits; repeated OOM callbacks cannot ratchet past `max_heap + 16 MiB`. |
| `ssrf_special_ranges` | **FBX-007 / I5** | `NetPolicy::default()` denies `100.64.0.1`, `100.100.100.100`, `64:ff9b::a9fe:a9fe`, `2002:7f00:1::`, `198.18.0.1`, and `224.0.0.1` across direct requests and HTTP 302 redirects. |
| `gate_slowloris_and_crlf` | **FBX-008** | Idle gate connections time out without renewing run `deadline`; duplicate `Content-Length` / `Transfer-Encoding` return `400`; `\r\n` in response headers cannot inject headers. |
| `worker_env_and_token_perms` | **FBX-002 / FBX-009 / I6** | `daemon.json` is created with `0o600` from birth on Unix; spawned workers do not inherit sentinel `FERNBOX_TEST_HOST_SECRET` env vars or extra file descriptors. |
| `concurrent_state_locks` | **FBX-010 / I7** | Parallel `Run`, `VolumeFiles`, and `Commit` operations never observe partial JSON or unlocked image races under `cargo test --workspace`. |

---

## 7. Vulnerability Reporting & Coordinated Disclosure

**Do not open public GitHub issues or pull requests for suspected security vulnerabilities.**

* **Reporting Channel:** Report vulnerabilities privately via GitHub Private Vulnerability Reporting (`Security -> Advisories -> Report a vulnerability`) on the repository.
* **Include in Your Report:**
  1. Affected crate(s), file paths, line numbers, and commit SHA.
  2. Threat profile required (e.g., untrusted guest JS, unprivileged local user, remote HTTP peer, or authenticated client).
  3. Minimal, non-destructive reproduction steps demonstrating boundary violation.
* **Response Targets:**
  * **Acknowledgement:** Within 48 hours of receipt.
  * **Triage & Severity Classification:** Within 5 business days.
  * **Remediation & Coordinated Advisory:** Target patch release within 14 days for Critical/High findings and 30 days for Medium/Low findings, with credit to reporters upon coordinated disclosure.

