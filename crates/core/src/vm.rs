//! The two-context boundary.
//!
//! Every FernBox isolate holds two V8 contexts in one heap:
//!
//! * the **system context**, which boots the bundled virtual-OS runtime and owns
//!   the privileged `__fernbox` object — the filesystem map, the network policy
//!   tables, everything the sandbox must never touch directly;
//! * the **user context**, where untrusted code runs, seeing only the frozen
//!   `fernbox` API object.
//!
//! The boundary between them is the whole security model, and it has exactly one
//! rule: **no object ever crosses it.** Values are marshalled to Rust primitives
//! in one context and re-created in the other. Handing a system-context object
//! into the user context is the vm2 escape — the user grabs its constructor,
//! walks to the system realm's `Function`, and runs arbitrary code there.

use std::convert::TryInto;
use std::time::{Duration, Instant};

use crate::isolate::{ExecutionParams, Limited, Limiter};
use crate::net::{NetBackend, NetRequest};
use crate::seed::InstanceSeed;
use crate::timers::{delay_from, TimerQueue};

/// The bundled system-context runtime, produced by esbuild at build time.
const VIRTUAL_OS: &str = include_str!(concat!(env!("OUT_DIR"), "/virtual_os.js"));

/// The Node-shaped surface the user context sees, booted before the entry
/// script runs. It is user-realm JS throughout: it reads the identity globals
/// `install_identity` set and builds `process`/`console`/`require` out of them,
/// talking to the frozen `fernbox` object, so nothing privileged ever crosses
/// into it. Its own locals stay inside the IIFE, and the modules `require`
/// compiles with the user realm's own `new Function` reach this context's
/// global, not the bundle's scope.
const USER_BOOT: &str = include_str!(concat!(env!("OUT_DIR"), "/user_runtime.js"));

/// Compile and run `source` in the already-entered system context.
fn run_script_in(
    scope: &mut v8::ContextScope<v8::HandleScope>,
    label: &str,
    source: &str,
) -> Result<(), String> {
    let code = v8::String::new(scope, source).ok_or("source too large")?;
    let script = v8::Script::compile(scope, code, None).ok_or("failed to compile")?;
    script.run(scope).map(|_| ()).ok_or_else(|| format!("`{label}` failed to run"))
}
///
/// Deliberately *not* stored in an isolate slot: rusty_v8 0.32's slot map hashes
/// `TypeId` with an assertion that it is 8 bytes, which is false on rustc 1.80+
/// where it is 16, so touching a slot panics. The `External` on each function
/// carries this pointer instead, which is also where V8's own API expects it.
pub struct VmState {
    /// The privileged context, kept alive past the boot scope.
    pub system: v8::Global<v8::Context>,
    /// `__fernbox` from the system context, resolved once at boot.
    pub api: v8::Global<v8::Value>,
    /// The network backend this instance fetches through. The daemon supplies
    /// one that round-trips the request over the worker channel; a bare
    /// in-process run uses [`DirectNet`], which calls `gated_fetch` on the spot.
    pub net: Box<dyn NetBackend>,
    /// The wall-clock instant the current run must end by, so a fetch started
    /// near the deadline is clamped to what is left rather than to the policy's
    /// own timeout. Set by `run`; the CPU watchdog cannot interrupt a syscall,
    /// so this bound is what keeps a slow peer from outliving the script.
    pub run_deadline: Option<Instant>,
    /// Timers the running script scheduled. Cleared at the start of each run.
    pub timers: TimerQueue,
    /// The caller's environment, as `KEY=VALUE`. The whole of `process.env`.
    pub env: Vec<String>,
    /// `process.argv`: `["node", entrypoint, ...args]`.
    pub argv: Vec<String>,
    /// The virtual path the entrypoint sits at, for the top level's `__dirname`.
    pub entrypoint: String,
    /// What the caller piped in. The whole of `process.stdin`.
    pub stdin: String,
    /// What the script wrote to its stdout. Cleared at the start of each run.
    pub stdout: String,
    /// What the script wrote to its stderr. Kept apart from stdout, the way a
    /// pipe does, so `console.error` cannot appear in a captured output stream.
    pub stderr: String,
    /// The port this run is granted to serve on, if any. A grant from the
    /// daemon, checked when the script calls `listen`: listening on any other
    /// port (or with no grant at all) is refused.
    pub publish: Option<u16>,
    /// The listening server, once the script calls `listen`. The dispatch is a
    /// user-realm function the event loop calls per request — held the same way
    /// timer callbacks are, so no system object is involved.
    pub server: Option<ServerState>,
    /// Requests the daemon forwarded, queued by the worker's reader thread. The
    /// event loop drains them; `None` on a bare run with no request source.
    pub requests: Option<std::sync::mpsc::Receiver<crate::server::IncomingRequest>>,
    /// Responses the script produced via `respond`, waiting to ship. Drained by
    /// the event loop after each callback, so an async handler that answers on a
    /// later timer is shipped just the same.
    pub responses: Vec<(u64, String)>,
    /// Where each new piece of script output goes, if the caller wants it live.
    /// Set by the worker to write a `Stdout` frame; left `None` by a bare run,
    /// where `stdout`/`stderr` above are the whole of it. The buffers are still
    /// appended to either way, because `Done` carries the full output as the
    /// fallback copy.
    pub output_sink: Option<crate::server::OutputSink>,
    /// Where the event loop sends a finished response. The worker writes a frame
    /// to the daemon; a test collects them. `None` drops them (a bare run).
    pub response_sink: Option<crate::server::ResponseSink>,
}

/// A listening server: the user-realm dispatcher the event loop calls with each
/// request's JSON. One per run; the port it holds is the run's single grant.
pub struct ServerState {
    pub dispatch: v8::Global<v8::Function>,
}

/// A sandboxed isolate. The virtual OS boots in the system context at
/// construction; `run` executes untrusted code in the user context.
pub struct Vm {
    limited: Limited,
    state: Box<VmState>,
    /// The hard lifetime cap for a serving run: renewal on activity may extend
    /// the deadline up to here and no further. `None` makes the deadline hard,
    /// which is what a plain (non-serving) run wants.
    max_life: Option<Duration>,
}

/// What happened when a script ran in the user context.
#[derive(Debug, PartialEq)]
pub enum VmOutcome {
    /// Script completed; its stringified return value.
    Completed(String),
    /// Blew past the CPU deadline.
    TimedOut,
    /// Blew past the heap limit.
    OutOfMemory,
    /// The virtual OS failed to boot, or the script failed to compile.
    Failed(String),
    /// The script ran and threw. Reported apart from `Failed` because a script
    /// that ran has written to its volumes, and that state is worth keeping —
    /// the same distinction a container makes between "would not start" and
    /// "exited nonzero".
    Threw(String),
}

impl Vm {
    /// Create the isolate and boot the virtual OS in the system context.
    ///
    /// `seed` is the filesystem the instance boots with, composed by the daemon
    /// from a base image, an app folder, and any attached volumes. `net` serves
    /// every fetch the script makes: in-process for a bare run, or a channel to
    /// the daemon for a worker, where the policy lives.
    pub fn new(
        params: &ExecutionParams,
        seed: &InstanceSeed,
        net: Box<dyn NetBackend>,
    ) -> Result<Vm, String> {
        let mut limited = Limited::new(params);
        let isolate = &mut limited.isolate;

        let (system, api) = {
            let scope = &mut v8::HandleScope::new(isolate);
            let context = v8::Context::new(scope);
            let scope = &mut v8::ContextScope::new(scope, context);

            // The seed is evaluated first so the runtime reads plain maps off
            // `globalThis.__fernbox_image` and `__fernbox_volumes` when it
            // boots, never the host disk.
            run_script_in(
                scope,
                "image",
                &format!("globalThis.__fernbox_image = {};", seed.image),
            )?;
            run_script_in(
                scope,
                "volumes",
                &format!("globalThis.__fernbox_volumes = {};", seed.volumes),
            )?;
            run_script_in(scope, "virtual_os.js", VIRTUAL_OS)?;

            let key = v8::String::new(scope, "__fernbox").unwrap();
            let api = context.global(scope).get(scope, key.into());
            let api = api.ok_or("`__fernbox` missing after boot")?;

            (
                v8::Global::new(&mut *scope, context),
                v8::Global::new(&mut *scope, api),
            )
        };

        let mut state = Box::new(VmState {
            system,
            api,
            net,
            run_deadline: None,
            timers: TimerQueue::default(),
            env: seed.env.clone(),
            argv: seed.argv.clone(),
            entrypoint: seed.entrypoint.clone(),
            stdin: seed.stdin.clone(),
            stdout: String::new(),
            stderr: String::new(),
            publish: None,
            server: None,
            requests: None,
            responses: Vec::new(),
            response_sink: None,
            output_sink: None,
        });

        // The privileged side gets the gated client: Rust functions the system
        // context calls to actually move bytes. They are installed after the
        // state exists so each can carry a pointer to it.
        {
            let isolate = &mut limited.isolate;
            let scope = &mut v8::HandleScope::new(isolate);
            let context = v8::Local::new(scope, &state.system);
            let scope = &mut v8::ContextScope::new(scope, context);

            let net = v8::Object::new(scope);
            add_method(scope, net, "fetch", net_fetch, &mut *state);
            let key = v8::String::new(scope, "__fernbox_net").unwrap();
            scope.get_current_context().global(scope).set(scope, key.into(), net.into());
        }

        Ok(Vm { limited, state, max_life: None })
    }

    /// Grant the port this run may serve on. The daemon passes what the caller
    /// asked for; `listen` refuses any other port. Set before `run`.
    pub fn set_publish(&mut self, port: Option<u16>) {
        self.state.publish = port;
    }

    /// Set the hard lifetime cap a serving run may renew up to. `None` keeps the
    /// deadline hard. Set before `run`.
    pub fn set_max_life(&mut self, cap: Option<Duration>) {
        self.max_life = cap;
    }

    /// Hand the event loop the channel the worker's reader thread queues
    /// forwarded requests on. Set before `run`.
    pub fn set_requests(&mut self, rx: std::sync::mpsc::Receiver<crate::server::IncomingRequest>) {
        self.state.requests = Some(rx);
    }

    /// Hand the event loop the sink that ships finished responses to the daemon.
    /// Set before `run`.
    pub fn set_response_sink(&mut self, sink: crate::server::ResponseSink) {
        self.state.response_sink = Some(sink);
    }

    /// Hand the isolate the sink that ships output as it is written. Set before
    /// `run`; without it, output is still buffered and reported at the end.
    pub fn set_output_sink(&mut self, sink: crate::server::OutputSink) {
        self.state.output_sink = Some(sink);
    }

    /// What the script wrote to its stdout. The daemon reports this alongside
    /// the completion value, so a `console.log` reaches the caller.
    pub fn output(&self) -> &str {
        &self.state.stdout
    }

    /// What the script wrote to its stderr, kept apart from stdout so a captured
    /// stdout stays clean for a caller parsing it as data.
    pub fn stderr(&self) -> &str {
        &self.state.stderr
    }

    /// Pull the volume layers back out of the isolate.    ///
    /// Only the daemon calls this, at the end of a run, to persist what the
    /// script wrote. It goes through the same `call_system` chokepoint as
    /// everything else, so no handle crosses the boundary; the answer comes back
    /// as one JSON string the daemon re-parses on its own side. The user context
    /// has no `snapshot` on its frozen API, so a script cannot ask for it.
    pub fn snapshot(&mut self) -> Result<String, String> {
        let isolate = &mut self.limited.isolate;
        let scope = &mut v8::HandleScope::new(isolate);
        match call_system(scope, &self.state, "snapshot", &[])? {
            Some(json) => Ok(json),
            None => Err("`__fernbox.snapshot` returned nothing".to_string()),
        }
    }

    /// Run `source` in the user context under the configured limits.
    ///
    /// A script that schedules timers does not finish when its top level does:
    /// the run stays open until the queue drains or the deadline kills it, and
    /// that is what makes `setTimeout` worth having.
    pub fn run(&mut self, source: &str, params: &ExecutionParams) -> VmOutcome {
        self.limited.arm_with_cap(params.deadline, self.max_life);
        self.state.timers.clear();
        self.state.stdout.clear();
        self.state.stderr.clear();
        self.state.server = None;
        self.state.responses.clear();
        let started = Instant::now();
        self.state.run_deadline = Some(started + params.deadline);

        let Vm { limited, state, .. } = self;

        let (context, compiled, failure, value) = {
            let isolate = &mut limited.isolate;
            let scope = &mut v8::HandleScope::new(isolate);
            let context = v8::Context::new(scope);
            let scope = &mut v8::ContextScope::new(scope, context);

            install_user_api(scope, &mut **state);
            if let Err(msg) = install_identity(scope, &mut **state) {
                return VmOutcome::Failed(msg);
            }
            // The boot bundle installs the globals the entry script reaches for
            // — `require`, `process`, `console`, `__dirname` — before it compiles,
            // so a top-level `const fs = require("fs")` finds them. It runs as
            // plain script, not a module: the entry's completion value is the
            // run's result, and this bundle's own return value is discarded.
            if let Err(msg) = run_script_in(scope, "user_boot.js", USER_BOOT) {
                return VmOutcome::Failed(msg);
            }

            // The try/catch is what tells a script that would not compile from
            // one that compiled and threw: both come back without a value, and
            // only the first means the run never started. It is scoped inside
            // its own block so the borrow of `scope` ends before the checkpoint
            // and the context capture below.
            let (failure, value, compiled) = {
                let try_catch = &mut v8::TryCatch::new(scope);
                let script = v8::String::new(try_catch, source)
                    .and_then(|code| v8::Script::compile(try_catch, code, None));
                match script {
                    Some(script) => {
                        let value = script.run(try_catch);
                        let message =
                            value.is_none().then(|| exception_message(try_catch)).flatten();
                        let text = value.map(|v| {
                            v.to_string(try_catch)
                                .map(|s| s.to_rust_string_lossy(try_catch))
                                .unwrap_or_default()
                        });
                        (message, text, true)
                    }
                    None => (exception_message(try_catch), None, false),
                }
            };

            // The script's own promises resolve here, before any timer fires,
            // so a `.then` chained off the top level does not race the queue.
            AsMut::<v8::Isolate>::as_mut(scope).perform_microtask_checkpoint();

            // Kept alive past this scope so the drain loop can re-enter it.
            let context = scope.get_current_context();
            let context = v8::Global::new(AsMut::<v8::Isolate>::as_mut(scope), context);

            (context, compiled, failure, value)
        };

        // A script that threw scheduled nothing worth waiting on; the drain
        // would have no work and would return immediately anyway, but skipping
        // it keeps the failure from being masked by a timer error.
        let result = match value {
            Some(text) => self.event_loop(&context, params.deadline).and(Ok(text)),
            None => Err(failure.unwrap_or_else(|| "script threw or produced no value".to_string())),
        };

        // A limiter firing during the drain overrides everything else: a
        // deadline kill mid-callback looks like a throw to V8, not a timeout.
        let limiter = self.limited.disarm();
        if matches!(limiter, Limiter::TimedOut | Limiter::OutOfMemory) {
            // The kill may have landed while the isolate was parked in the
            // drain loop rather than running JS, so V8 never got the entry it
            // needs to throw the termination and clear the flag. Left
            // scheduled, it kills whichever script runs here next — one
            // script's deadline must not reach into another's.
            self.limited.isolate.cancel_terminate_execution();
        }
        match limiter {
            Limiter::TimedOut => VmOutcome::TimedOut,
            Limiter::OutOfMemory => VmOutcome::OutOfMemory,
            Limiter::Neither => match result {
                Ok(text) => VmOutcome::Completed(text),
                Err(msg) => {
                    if compiled {
                        VmOutcome::Threw(msg)
                    } else {
                        VmOutcome::Failed(msg)
                    }
                }
            },
        }
    }

    /// Keep the run alive while there is work: fire due timers, dispatch
    /// forwarded requests, ship responses. A listening server keeps the loop
    /// open even with an empty timer queue — that is what makes a service stay
    /// up — and each request it serves renews the idle budget. The loop ends
    /// when nothing is keeping it alive (no timers, no server) or the limiter
    /// fires.
    ///
    /// Each callback re-enters the user context for exactly as long as it takes
    /// to call one function, so nothing V8-owned outlives the iteration and the
    /// limiter can be read between callbacks without fighting the scope borrow.
    fn event_loop(
        &mut self,
        context: &v8::Global<v8::Context>,
        idle: Duration,
    ) -> Result<(), String> {
        use std::sync::mpsc::RecvTimeoutError;
        let mut first_error = None;

        loop {
            if self.limited.timed_out() || self.limited.oom() {
                break;
            }
            if self.state.timers.is_empty() && self.state.server.is_none() {
                break;
            }

            // Fire every timer whose time has come. A bad callback is reported
            // but does not cost the script the rest of its queue.
            let due = self.state.timers.drain_due(Instant::now());
            for timer in due {
                let isolate = &mut self.limited.isolate;
                let scope = &mut v8::HandleScope::new(isolate);
                let ctx = v8::Local::new(scope, context);
                let scope = &mut v8::ContextScope::new(scope, ctx);

                let callback = v8::Local::new(scope, &timer.callback);
                let try_catch = &mut v8::TryCatch::new(scope);
                let undefined = v8::undefined(try_catch);
                if callback.call(try_catch, undefined.into(), &[]).is_none() && first_error.is_none()
                {
                    first_error = exception_message(try_catch);
                }
                AsMut::<v8::Isolate>::as_mut(try_catch).perform_microtask_checkpoint();
            }
            self.ship_responses();

            // Dispatch every request already queued — a burst since the last wait.
            while let Some(request) = self.try_recv_request() {
                self.handle_request(context, request, idle, &mut first_error);
                self.ship_responses();
                if self.limited.timed_out() || self.limited.oom() {
                    break;
                }
            }
            if self.limited.timed_out() || self.limited.oom() {
                break;
            }
            if self.state.timers.is_empty() && self.state.server.is_none() {
                break;
            }

            // Wait for the next timer or a fresh request, whichever is sooner.
            // The poll ceiling keeps the loop responsive to the limiter even
            // when parked on a long timer; the watchdog is what actually kills.
            let poll = Duration::from_millis(20);
            let wait = match self.state.timers.next_deadline() {
                Some(next) => next
                    .saturating_duration_since(Instant::now())
                    .min(poll)
                    .max(Duration::from_millis(1)),
                None => poll,
            };
            let mut source_closed = false;
            let incoming = match &self.state.requests {
                Some(rx) => match rx.recv_timeout(wait) {
                    Ok(request) => Some(request),
                    Err(RecvTimeoutError::Timeout) => None,
                    Err(RecvTimeoutError::Disconnected) => {
                        source_closed = true;
                        None
                    }
                },
                None => {
                    std::thread::sleep(wait);
                    None
                }
            };
            // The request source is gone; stop waiting on it. Timers still drain.
            if source_closed {
                self.state.requests = None;
            }
            if let Some(request) = incoming {
                self.handle_request(context, request, idle, &mut first_error);
                self.ship_responses();
            }
        }

        first_error.map(Err).unwrap_or(Ok(()))
    }

    /// Take one queued request without blocking, if the source has any.
    fn try_recv_request(&mut self) -> Option<crate::server::IncomingRequest> {
        match &self.state.requests {
            Some(rx) => rx.try_recv().ok(),
            None => None,
        }
    }

    /// Dispatch one forwarded request into the user realm, renewing the idle
    /// budget first: serving a request is the activity that buys a service more
    /// time. With no server listening, answer 503 without entering the realm.
    fn handle_request(
        &mut self,
        context: &v8::Global<v8::Context>,
        request: crate::server::IncomingRequest,
        idle: Duration,
        first_error: &mut Option<String>,
    ) {
        let now = Instant::now();
        self.limited.renew(now + idle);
        self.state.run_deadline = Some(now + idle);

        // Clone the dispatcher out so no borrow on the server state survives
        // into the scope below.
        let dispatch = match &self.state.server {
            Some(server) => server.dispatch.clone(),
            None => {
                self.state
                    .responses
                    .push((request.id, crate::server::service_unavailable_b64()));
                return;
            }
        };

        let request_json =
            serde_json::json!({ "id": request.id, "raw_b64": request.raw_b64 }).to_string();
        let isolate = &mut self.limited.isolate;
        let scope = &mut v8::HandleScope::new(isolate);
        let ctx = v8::Local::new(scope, context);
        let scope = &mut v8::ContextScope::new(scope, ctx);

        let dispatch = v8::Local::new(scope, &dispatch);
        let arg = user_string(scope, &request_json);
        let try_catch = &mut v8::TryCatch::new(scope);
        let undefined = v8::undefined(try_catch);
        if dispatch.call(try_catch, undefined.into(), &[arg]).is_none() && first_error.is_none() {
            *first_error = exception_message(try_catch);
        }
        AsMut::<v8::Isolate>::as_mut(try_catch).perform_microtask_checkpoint();
    }

    /// Hand every queued response to the sink. Called between callbacks so the
    /// write never races a fetch's frame, and after each callback so an async
    /// handler that answers on a later timer is shipped when it answers.
    fn ship_responses(&mut self) {
        if self.state.responses.is_empty() {
            return;
        }
        let responses = std::mem::take(&mut self.state.responses);
        if let Some(sink) = &mut self.state.response_sink {
            for (id, raw_b64) in responses {
                sink(id, raw_b64);
            }
        }
    }
}

/// Install the frozen `fernbox` object on the user context's global.
///
/// Every method is a `v8::Function` built *in the user context*, so its
/// `.constructor` resolves to the user realm's `Function`, never the system
/// one. Each method marshals its arguments to Rust, calls into the system
/// context, and re-creates the result in the user context.
fn install_user_api(scope: &mut v8::ContextScope<v8::HandleScope>, state: &mut VmState) {
    let global = scope.get_current_context().global(scope);
    let api = v8::Object::new(scope);

    // The pointer is valid for as long as the Vm, which outlives every run.
    let ptr = state as *mut VmState;

    add_method(scope, api, "read", fs_read, ptr);
    add_method(scope, api, "write", fs_write, ptr);
    add_method(scope, api, "list", fs_list, ptr);

    // Timers are flat on the API rather than nested under `fernbox.timers`;
    // there is no object a script could reach to swap them out, and the flat
    // shape is what every JS author reaches for first.
    add_method(scope, api, "setTimeout", set_timeout, ptr);
    add_method(scope, api, "setInterval", set_interval, ptr);
    // Both clears take the same path: the ids share one namespace, so
    // `clearTimeout` on an interval handle is a no-op either way.
    add_method(scope, api, "clearTimeout", clear_timer, ptr);
    add_method(scope, api, "clearInterval", clear_timer, ptr);

    // The wider filesystem surface. Nested so the flat `read`/`write`/`list` the
    // fixtures use stay where they are, and frozen with the rest.
    let fstree = v8::Object::new(scope);
    add_method(scope, fstree, "mkdir", fs_mkdir, ptr);
    add_method(scope, fstree, "stat", fs_stat, ptr);
    add_method(scope, fstree, "readdir", fs_readdir, ptr);
    add_method(scope, fstree, "exists", fs_exists, ptr);
    add_method(scope, fstree, "unlink", fs_unlink, ptr);
    add_method(scope, fstree, "rmdir", fs_rmdir, ptr);
    add_method(scope, fstree, "rename", fs_rename, ptr);
    freeze(scope, fstree);
    let fs_key = v8::String::new(scope, "fs").unwrap();
    api.set(scope, fs_key.into(), fstree.into());

    // The network surface is a nested object so the top-level API stays flat;
    // it is frozen with the rest, so `fernbox.http` cannot be swapped out any
    // more than `fernbox.read` can.
    let http = v8::Object::new(scope);
    add_method(scope, http, "fetch", http_fetch, ptr);
    // The serving surface. `listen` registers a user-realm dispatcher (held like
    // a timer callback); `respond` queues a finished response; `close` stops
    // listening. All strings in, all strings out — the request bytes and the
    // response bytes cross as base64 text, never as objects.
    add_method(scope, http, "listen", http_listen, ptr);
    add_method(scope, http, "respond", http_respond, ptr);
    add_method(scope, http, "close", http_close, ptr);
    freeze(scope, http);
    let http_key = v8::String::new(scope, "http").unwrap();
    api.set(scope, http_key.into(), http.into());

    // The stdio sinks. `process.stdout` and `process.stderr` are the only two
    // things that write here, and they are write-only: a script cannot read
    // back what another part of itself printed.
    let stdio = v8::Object::new(scope);
    add_method(scope, stdio, "write", stdio_write, ptr);
    freeze(scope, stdio);
    let stdio_key = v8::String::new(scope, "stdio").unwrap();
    api.set(scope, stdio_key.into(), stdio.into());

    // User code must not be able to swap `fernbox.read` for a spy that sees
    // what other callers pass in.
    freeze(scope, api);

    let name = v8::String::new(scope, "fernbox").unwrap();
    global.set(scope, name.into(), api.into());
}

/// Put the process identity on the user global before the script compiles, as
/// plain data the boot bundle reads when it builds `process`. These are the
/// app's own values — the caller's env and argv, the entrypoint's virtual path,
/// and what it piped in — so living on the user global is where they belong.
fn install_identity(
    scope: &mut v8::ContextScope<v8::HandleScope>,
    state: &mut VmState,
) -> Result<(), String> {
    // The values are Rust-side, so they are serialized rather than interpolated:
    // an env value containing a quote must not become code.
    let argv = serde_json::to_string(&state.argv).unwrap_or_else(|_| "[]".to_string());
    run_script_in(scope, "__fernbox_argv", &format!("globalThis.__fernbox_argv = {argv};"))?;
    let env = serde_json::to_string(&state.env).unwrap_or_else(|_| "[]".to_string());
    run_script_in(scope, "__fernbox_env", &format!("globalThis.__fernbox_env = {env};"))?;
    let entry =
        serde_json::to_string(&state.entrypoint).unwrap_or_else(|_| "\"/main.js\"".to_string());
    run_script_in(scope, "__fernbox_entry", &format!("globalThis.__fernbox_entry = {entry};"))?;
    let stdin = serde_json::to_string(&state.stdin).unwrap_or_else(|_| "\"\"".to_string());
    run_script_in(scope, "__fernbox_stdin", &format!("globalThis.__fernbox_stdin = {stdin};"))
}

fn add_method(
    scope: &mut v8::ContextScope<v8::HandleScope>,
    api: v8::Local<v8::Object>,
    name: &str,
    callback: impl v8::MapFnTo<v8::FunctionCallback>,
    state: *mut VmState,
) {
    // `data` is how the callback reaches the system context without an isolate
    // slot. Built with the builder rather than `Function::new` for that reason.
    let data = v8::External::new(scope, state as *mut std::ffi::c_void).into();
    let function = v8::FunctionBuilder::<v8::Function>::new(callback)
        .data(data)
        .build(scope)
        .unwrap();
    let key = v8::String::new(scope, name).unwrap();
    api.set(scope, key.into(), function.into());
}

fn freeze(scope: &mut v8::ContextScope<v8::HandleScope>, object: v8::Local<v8::Object>) {
    let global = scope.get_current_context().global(scope);
    let object_key = v8::String::new(scope, "Object").unwrap();
    let ctor = global
        .get(scope, object_key.into())
        .unwrap()
        .to_object(scope)
        .unwrap();
    let freeze_key = v8::String::new(scope, "freeze").unwrap();
    let freeze: v8::Local<v8::Function> = ctor
        .get(scope, freeze_key.into())
        .unwrap()
        .try_into()
        .unwrap();
    let undefined = v8::undefined(scope);
    freeze.call(scope, undefined.into(), &[object.into()]);
}

/// Pull the shared state off a callback's `data`.
fn state_of(args: &v8::FunctionCallbackArguments) -> &'static mut VmState {
    let external: v8::Local<v8::External> = args
        .data()
        .expect("fernbox methods must carry their state")
        .try_into()
        .expect("the carried state must be an External");
    unsafe { &mut *(external.value() as *mut VmState) }
}

/// Schedule a one-shot timer. The id comes back so the script can cancel it.
fn set_timeout(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    schedule_timer(scope, &args, &mut rv, false);
}

/// Schedule a repeating timer.
fn set_interval(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    schedule_timer(scope, &args, &mut rv, true);
}

fn schedule_timer(
    scope: &mut v8::HandleScope,
    args: &v8::FunctionCallbackArguments,
    rv: &mut v8::ReturnValue,
    repeating: bool,
) {
    let Some(callback) = arg_function(args, 0) else {
        return throw(scope, "a timer needs a function");
    };
    let delay = delay_from(scope, args, 1);
    let state = state_of(args);
    match state
        .timers
        .schedule(scope.as_mut(), callback, delay, repeating.then_some(delay))
    {
        Some(id) => rv.set(v8::Integer::new(scope, id as i32).into()),
        None => throw(scope, "too many pending timers"),
    }
}

/// Cancel a timer by id. Unknown ids are ignored, the way they are in a browser.
fn clear_timer(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(id) = arg_integer(scope, &args, 0) else {
        return;
    };
    state_of(&args).timers.cancel(id);
    rv.set(v8::undefined(scope).into());
}

/// A function argument from the call, or `None` if it is not callable.
fn arg_function<'s>(
    args: &v8::FunctionCallbackArguments<'s>,
    index: usize,
) -> Option<v8::Local<'s, v8::Function>> {
    if index >= args.length() as usize {
        return None;
    }
    args.get(index as i32).try_into().ok()
}

/// A non-negative integer argument, or `None` if the slot holds something else.
fn arg_integer(scope: &mut v8::HandleScope, args: &v8::FunctionCallbackArguments, index: usize) -> Option<u32> {
    if index >= args.length() as usize {
        return None;
    }
    let value = args.get(index as i32);
    value
        .number_value(scope)
        .filter(|n| n.fract() == 0.0 && *n >= 0.0)
        .map(|n| n as u32)
}

/// Append to a stdio sink. `which` is `"stdout"` or `"stderr"`; anything else
/// is ignored rather than thrown, so a boot bundle's typo cannot kill a script
/// that only wanted to print.
fn stdio_write(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(text) = arg_string(scope, &args, 0) else {
        return;
    };
    let which = arg_string(scope, &args, 1).unwrap_or_default();
    let state = state_of(&args);
    // The buffer is always appended to — it is what `Done` reports, and what a
    // run without a sink has instead of streaming. The sink, when there is one,
    // gets the same bytes as they arrive so a watching caller sees them now
    // rather than all at the end.
    let (buffer, is_stdout) = match which.as_str() {
        "stdout" => (&mut state.stdout, true),
        "stderr" => (&mut state.stderr, false),
        _ => {
            rv.set(v8::undefined(scope).into());
            return;
        }
    };
    buffer.push_str(&text);
    if let Some(sink) = state.output_sink.as_mut() {
        sink(&text, is_stdout);
    }
    rv.set(v8::undefined(scope).into());
}

/// The shape every `fernbox.fs` op shares: hand the marshalled arguments to the
/// privileged side and give its JSON answer back to the user realm. A refusal
/// arrives as `{"error":"ENOENT",...}` rather than a throw, so the builtin above
/// can rethrow it carrying the code — a caller's `catch` sees `e.code`.
fn fs_call(
    scope: &mut v8::HandleScope,
    args: &v8::FunctionCallbackArguments,
    rv: &mut v8::ReturnValue,
    method: &str,
    params: Vec<String>,
) {
    let state = state_of(args);
    match call_system(scope, state, method, &params) {
        Ok(Some(json)) => rv.set(user_string(scope, &json)),
        Ok(None) => rv.set(v8::null(scope).into()),
        Err(msg) => throw(scope, &msg),
    }
}

/// Collect a path argument, or refuse if the caller did not hand one in.
fn fs_path(
    scope: &mut v8::HandleScope,
    args: &v8::FunctionCallbackArguments,
    method: &str,
) -> Option<String> {
    arg_string(scope, args, 0).or_else(|| {
        throw(scope, &format!("fernbox.fs.{method} needs a path"));
        None
    })
}

fn fs_mkdir(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(path) = fs_path(scope, &args, "mkdir") else {
        return;
    };
    // Options are stringified in the user realm, the way fetch's are, so an
    // object never crosses the boundary.
    let options = arg_options(scope, &args, 1);
    fs_call(scope, &args, &mut rv, "fsMkdir", vec![path, options]);
}

fn fs_stat(scope: &mut v8::HandleScope, args: v8::FunctionCallbackArguments, mut rv: v8::ReturnValue) {
    let Some(path) = fs_path(scope, &args, "stat") else {
        return;
    };
    fs_call(scope, &args, &mut rv, "fsStat", vec![path]);
}

fn fs_readdir(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(path) = fs_path(scope, &args, "readdir") else {
        return;
    };
    fs_call(scope, &args, &mut rv, "fsReaddir", vec![path]);
}

fn fs_exists(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(path) = fs_path(scope, &args, "exists") else {
        return;
    };
    // The privileged side answers the JSON text `"true"` or `"false"`, and both
    // of those are truthy as strings — so the caller gets a real boolean and
    // `if (fs.exists(p))` means what it says. The crossing is still text.
    let state = state_of(&args);
    match call_system(scope, state, "fsExists", &[path]) {
        Ok(Some(json)) => rv.set(v8::Boolean::new(scope, json == "true").into()),
        Ok(None) => rv.set(v8::Boolean::new(scope, false).into()),
        Err(msg) => throw(scope, &msg),
    }
}

fn fs_unlink(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(path) = fs_path(scope, &args, "unlink") else {
        return;
    };
    fs_call(scope, &args, &mut rv, "fsUnlink", vec![path]);
}

fn fs_rmdir(scope: &mut v8::HandleScope, args: v8::FunctionCallbackArguments, mut rv: v8::ReturnValue) {
    let Some(path) = fs_path(scope, &args, "rmdir") else {
        return;
    };
    fs_call(scope, &args, &mut rv, "fsRmdir", vec![path]);
}

fn fs_rename(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(from) = fs_path(scope, &args, "rename") else {
        return;
    };
    let Some(to) = arg_string(scope, &args, 1).or_else(|| {
        throw(scope, "fernbox.fs.rename needs a destination");
        None
    }) else {
        return;
    };
    fs_call(scope, &args, &mut rv, "fsRename", vec![from, to]);
}

// --- the user-context API surface -----------------------------------------

/// Read a virtual file. Returns its contents, or null if it doesn't exist.
fn fs_read(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(path) = arg_string(scope, &args, 0) else {
        return;
    };
    let state = state_of(&args);
    match call_system(scope, state, "fsRead", &[path]) {
        Ok(Some(contents)) => rv.set(user_string(scope, &contents)),
        Ok(None) => rv.set(v8::null(scope).into()),
        Err(msg) => throw(scope, &msg),
    }
}

/// Write a virtual file. Returns the number of bytes written.
fn fs_write(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(path) = arg_string(scope, &args, 0) else {
        return;
    };
    let Some(data) = arg_string(scope, &args, 1) else {
        return;
    };
    let state = state_of(&args);
    match call_system(scope, state, "fsWrite", &[path, data]) {
        Ok(Some(count)) => rv.set(v8::Integer::new(scope, count.parse().unwrap_or(0)).into()),
        Ok(None) => rv.set(v8::undefined(scope).into()),
        Err(msg) => throw(scope, &msg),
    }
}

/// List every virtual path.
fn fs_list(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let state = state_of(&args);
    match call_system(scope, state, "fsList", &[]) {
        Ok(Some(listing)) => rv.set(user_string(scope, &listing)),
        Ok(None) => rv.set(v8::undefined(scope).into()),
        Err(msg) => throw(scope, &msg),
    }
}

/// Fetch a URL under this instance's network policy.
///
/// `options` is a user-realm object — it is stringified in that realm before it
/// crosses, so nothing but text makes the trip. The response comes back the same
/// way, as one JSON string the caller re-parses over there.
fn http_fetch(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let Some(url) = arg_string(scope, &args, 0) else {
        return throw(scope, "fetch needs a url");
    };
    let options = arg_options(scope, &args, 1);
    let state = state_of(&args);
    match call_system(scope, state, "httpFetch", &[url, options]) {
        Ok(Some(json)) => rv.set(user_string(scope, &json)),
        Ok(None) => rv.set(v8::undefined(scope).into()),
        Err(msg) => throw(scope, &msg),
    }
}

/// Register the script's server. `port` must be the one this run was granted;
/// `dispatch` is the user-realm function the event loop calls per request. The
/// grant is the whole authorization: a run with no published port cannot listen,
/// and a run granted one port cannot listen on another.
fn http_listen(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let state = state_of(&args);
    let Some(port_text) = arg_string(scope, &args, 0) else {
        return throw(scope, "listen needs a port");
    };
    let Ok(port) = port_text.parse::<u16>() else {
        return throw(scope, "listen needs a numeric port");
    };
    if state.publish != Some(port) {
        return throw(scope, &format!("ERR_PUBLISH: this run was not granted port {port}"));
    }
    if state.server.is_some() {
        return throw(scope, "EADDRINUSE: a server is already listening");
    }
    let Some(dispatch) = arg_function(&args, 1) else {
        return throw(scope, "listen needs a dispatch function");
    };
    state.server = Some(ServerState { dispatch: v8::Global::new(scope, dispatch) });
    rv.set(v8::undefined(scope).into());
}

/// Queue a finished response. The user realm's `res.end` calls this with the
/// request id and the whole response base64-encoded; the event loop ships it.
/// Queued rather than sent here so a handler that answers on a later timer is
/// shipped just the same, and so the write happens on the run thread between
/// callbacks — never racing a fetch's own frame.
fn http_respond(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let state = state_of(&args);
    let Some(id_text) = arg_string(scope, &args, 0) else {
        return throw(scope, "respond needs a request id");
    };
    let Ok(id) = id_text.parse::<u64>() else {
        return throw(scope, "respond needs a numeric request id");
    };
    let Some(raw_b64) = arg_string(scope, &args, 1) else {
        return throw(scope, "respond needs a response");
    };
    state.responses.push((id, raw_b64));
    rv.set(v8::undefined(scope).into());
}

/// Stop listening. The event loop ends the run once the timer queue drains too,
/// the way a Node process exits when nothing is keeping its loop alive.
fn http_close(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    state_of(&args).server = None;
    rv.set(v8::undefined(scope).into());
}

/// The options a fetch takes, as the user realm handed them over.
#[derive(serde::Deserialize)]
struct FetchOptions {
    #[serde(default)]
    method: String,
    #[serde(default)]
    headers: std::collections::HashMap<String, String>,
    #[serde(default)]
    body: Option<String>,
}

/// The privileged half of a fetch: parse the marshalled request, hand it to the
/// network backend, and return the response as JSON. Anything refused is thrown,
/// and `call_system` carries the message across to the caller.
///
/// The budget is what is left of the run when the fetch is made. The backend's
/// own timeout is the ceiling; this is the floor, and it is what keeps a fetch
/// started at the last moment from holding the isolate past the script's
/// deadline — the CPU watchdog can interrupt a loop but not a syscall.
fn net_fetch(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let state = state_of(&args);
    let Some(hosts) = arg_string(scope, &args, 0) else {
        return throw(scope, "fetch needs the virtual hosts text");
    };
    let Some(url) = arg_string(scope, &args, 1) else {
        return throw(scope, "fetch needs a url");
    };
    let options = arg_string(scope, &args, 2).unwrap_or_else(|| "{}".to_string());

    let Ok(options) = serde_json::from_str::<FetchOptions>(&options) else {
        return throw(scope, "fetch options must be a JSON object");
    };

    let request = NetRequest {
        url,
        method: if options.method.is_empty() {
            "GET".to_string()
        } else {
            options.method
        },
        headers: options.headers.into_iter().collect(),
        body: options.body,
    };

    // A fetch outside a run has no deadline to clamp to; the policy timeout
    // alone bounds it, which is the bare-run behaviour.
    let budget = state
        .run_deadline
        .map(|deadline| deadline.saturating_duration_since(Instant::now()))
        .unwrap_or_else(|| Duration::from_secs(u32::MAX as u64));

    match state.net.fetch(&hosts, &request, budget) {
        Ok(response) => match serde_json::to_string(&response) {
            Ok(json) => {
                let text = v8::String::new(scope, &json)
                    .unwrap_or_else(|| v8::String::new(scope, "").unwrap());
                rv.set(text.into());
            }
            Err(e) => throw(scope, &format!("the response could not be encoded: {e}")),
        },
        Err(err) => throw(scope, &err.message()),
    }
}

/// Stringify the fetch options in the user realm, or `"{}"` if there are none.
fn arg_options(
    scope: &mut v8::HandleScope,
    args: &v8::FunctionCallbackArguments,
    index: usize,
) -> String {
    if index >= args.length() as usize {
        return "{}".to_string();
    }
    let value = args.get(index as i32);
    if value.is_null_or_undefined() {
        return "{}".to_string();
    }

    let global = scope.get_current_context().global(scope);
    let json = v8::String::new(scope, "JSON").unwrap();
    let Some(json) = global.get(scope, json.into()) else {
        return "{}".to_string();
    };
    let Some(json) = json.to_object(scope) else {
        return "{}".to_string();
    };
    let key = v8::String::new(scope, "stringify").unwrap();
    let stringify: v8::Local<v8::Function> = match json.get(scope, key.into()) {
        Some(f) => match f.try_into() {
            Ok(f) => f,
            Err(_) => return "{}".to_string(),
        },
        None => return "{}".to_string(),
    };

    let undefined = v8::undefined(scope);
    stringify
        .call(scope, undefined.into(), &[value])
        .map(|text| text.to_rust_string_lossy(scope))
        .unwrap_or_else(|| "{}".to_string())
}

/// Call a `__fernbox` method from within a user-context callback.
///
/// This is the only chokepoint between the two realms. The arguments are owned
/// Rust strings — locals from the user context are never passed in — and the
/// result comes back as a Rust string that the caller re-creates in the user
/// context. No handle crosses the boundary in either direction.
fn call_system(
    scope: &mut v8::HandleScope<'_, ()>,
    state: &VmState,
    method: &str,
    args: &[String],
) -> Result<Option<String>, String> {
    // Entered only for the duration of the call, then dropped on the way out.
    let system_context = v8::Local::new(scope, &state.system);
    let system_scope = &mut v8::ContextScope::new(scope, system_context);

    let api = v8::Local::new(system_scope, &state.api);
    let api = api
        .to_object(system_scope)
        .ok_or("`__fernbox` is not an object")?;

    let key = v8::String::new(system_scope, method).unwrap();
    let function: v8::Local<v8::Function> = api
        .get(system_scope, key.into())
        .ok_or(format!("`__fernbox.{method}` missing"))?
        .try_into()
        .map_err(|_| format!("`__fernbox.{method}` is not callable"))?;

    let params: Vec<v8::Local<v8::Value>> = args
        .iter()
        .map(|a| v8::String::new(system_scope, a).unwrap().into())
        .collect();

    // The try/catch is here so a refusal arrives as its own text. Without it
    // every policy denial, missing host, and bad url looks identical to the
    // script, and there is no way to tell "not allowed" from "not found".
    let try_catch = &mut v8::TryCatch::new(system_scope);
    let Some(result) = function.call(try_catch, api.into(), &params) else {
        let message = try_catch
            .message()
            .map(|m| m.get(try_catch).to_rust_string_lossy(try_catch));
        let mut message = message.unwrap_or_else(|| format!("`__fernbox.{method}` threw"));
        // V8 frames the message with its own "Uncaught Error: " prefix, which
        // is about its internals rather than the refusal the script asked about.
        if let Some(stripped) = message.strip_prefix("Uncaught Error: ") {
            message = stripped.to_string();
        } else if let Some(stripped) = message.strip_prefix("Uncaught ") {
            message = stripped.to_string();
        }
        return Err(message);
    };

    if result.is_null_or_undefined() {
        Ok(None)
    } else {
        Ok(Some(result.to_rust_string_lossy(try_catch)))
    }
}

/// A string argument from the call, or `None` if it isn't one.
fn arg_string(
    scope: &mut v8::HandleScope,
    args: &v8::FunctionCallbackArguments,
    index: usize,
) -> Option<String> {
    if index >= args.length() as usize {
        return None;
    }
    let value = args.get(index as i32);
    if value.is_string() {
        Some(value.to_rust_string_lossy(scope))
    } else {
        None
    }
}

/// Re-create a Rust string in the user context. The caller's scope is entered
/// there, so the new local belongs to the user realm.
fn user_string<'s>(scope: &mut v8::HandleScope<'s>, text: &str) -> v8::Local<'s, v8::Value> {
    v8::String::new(scope, text)
        .unwrap_or_else(|| v8::String::new(scope, "").unwrap())
        .into()
}

fn throw(scope: &mut v8::HandleScope, message: &str) {
    let message = v8::String::new(scope, message).unwrap();
    let exception = v8::Exception::error(scope, message);
    scope.throw_exception(exception);
}

/// The text of a caught exception, without V8's own framing.
fn exception_message<'s, 'p, P>(try_catch: &mut v8::TryCatch<'s, P>) -> Option<String>
where
    'p: 's,
    v8::TryCatch<'s, P>: AsMut<v8::HandleScope<'p, ()>>,
    v8::TryCatch<'s, P>: AsMut<v8::HandleScope<'p>>,
{
    let message = try_catch.message()?;
    let scope = AsMut::<v8::HandleScope<'p>>::as_mut(try_catch);
    let mut text = message.get(scope).to_rust_string_lossy(scope);
    // V8 prefixes the message with its own machinery; the caller asked about
    // the script, not about uncaught handling.
    if let Some(stripped) = text.strip_prefix("Uncaught Error: ") {
        text = stripped.to_string();
    } else if let Some(stripped) = text.strip_prefix("Uncaught ") {
        text = stripped.to_string();
    }
    Some(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::isolate::ExecutionParams;
    use crate::net::{DirectNet, NetPolicy};
    use crate::seed::embedded_image_json;
    use std::time::Duration;

    /// Run a script in a fresh isolate over the `base` image, returning the
    /// completion value. Every assertion below is one script's worth of work,
    /// because that is the only way to reach the fs from a test.
    fn completed(source: &str) -> String {
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .expect("the virtual OS booted");
        match vm.run(source, &params) {
            VmOutcome::Completed(value) => value,
            other => panic!("the script did not complete: {other:?}"),
        }
    }

    /// The same run over a chosen image: a personality is what its files make it,
    /// and only the image that ships a command can test that command.
    fn completed_over(source: &str, image: &str) -> String {
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded(image)
                .unwrap_or_else(|_| panic!("the {image} image is bundled")),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .expect("the virtual OS booted");
        match vm.run(source, &params) {
            VmOutcome::Completed(value) => value,
            other => panic!("the script did not complete: {other:?}"),
        }
    }

    /// Run a serving script with a grant, injected requests, and a collecting
    /// sink. The request source is closed up front so the loop drains what was
    /// queued and then ends when the script stops listening — a test server
    /// answers and closes, rather than idling to its deadline.
    fn serve(
        source: &str,
        publish: Option<u16>,
        requests: Vec<crate::server::IncomingRequest>,
        idle_ms: u64,
        max_life_ms: Option<u64>,
    ) -> (VmOutcome, Vec<(u64, String)>) {
        use std::sync::{Arc, Mutex};
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_millis(idle_ms),
        };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .expect("the virtual OS booted");
        vm.set_publish(publish);
        vm.set_max_life(max_life_ms.map(Duration::from_millis));

        let (tx, rx) = std::sync::mpsc::channel();
        for request in requests {
            tx.send(request).unwrap();
        }
        drop(tx);
        vm.set_requests(rx);

        let collected: Arc<Mutex<Vec<(u64, String)>>> = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&collected);
        vm.set_response_sink(Box::new(move |id, raw| sink.lock().unwrap().push((id, raw))));

        let outcome = vm.run(source, &params);
        let responses = collected.lock().unwrap().clone();
        (outcome, responses)
    }

    fn request(id: u64) -> crate::server::IncomingRequest {
        crate::server::IncomingRequest { id, raw_b64: "R0VUIC8gSFRUUC8xLjE=".into() }
    }

    #[test]
    fn listen_without_a_grant_is_refused() {
        let (outcome, _) = serve(
            r#"try { fernbox.http.listen("8080", () => {}); "no throw" } catch (e) { e.message }"#,
            None,
            vec![],
            1000,
            None,
        );
        let VmOutcome::Completed(message) = outcome else { panic!("expected a caught refusal") };
        assert!(message.contains("ERR_PUBLISH"), "got: {message}");
    }

    #[test]
    fn listen_on_another_port_is_refused() {
        let (outcome, _) = serve(
            r#"try { fernbox.http.listen("9090", () => {}); "no throw" } catch (e) { e.message }"#,
            Some(8080),
            vec![],
            1000,
            None,
        );
        let VmOutcome::Completed(message) = outcome else { panic!("expected a caught refusal") };
        assert!(message.contains("ERR_PUBLISH"), "got: {message}");
    }

    #[test]
    fn a_granted_server_answers_a_request() {
        let (outcome, responses) = serve(
            r#"
            fernbox.http.listen("8080", (requestJson) => {
                const req = JSON.parse(requestJson);
                fernbox.http.respond(String(req.id), "cmVzcG9uc2U=");
                fernbox.http.close();
            });
            "listening"
            "#,
            Some(8080),
            vec![request(1)],
            2000,
            None,
        );
        assert_eq!(outcome, VmOutcome::Completed("listening".into()));
        assert_eq!(responses, vec![(1, "cmVzcG9uc2U=".to_string())]);
    }

    #[test]
    fn a_request_with_no_server_gets_503() {
        // A timer keeps the loop alive but nothing listens, so the forwarded
        // request is answered by the event loop itself, not the user realm.
        let (outcome, responses) = serve(
            r#"fernbox.setTimeout(() => {}, 50); "no server""#,
            Some(8080),
            vec![request(5)],
            2000,
            None,
        );
        assert_eq!(outcome, VmOutcome::Completed("no server".into()));
        assert_eq!(responses.len(), 1);
        assert_eq!(responses[0].0, 5);
        assert_eq!(responses[0].1, crate::server::service_unavailable_b64());
    }

    #[test]
    fn serving_renews_the_idle_budget() {
        use std::sync::mpsc;
        crate::init_v8();
        // The idle budget is 1s; a timer closes the server at 1.1s from script
        // start (itself after boot). A request arriving at ~800ms renews to
        // ~1.8s from run start, so the timer fires and the run completes —
        // which only happens if serving bought more time. The budgets include
        // the boot bundle's compile time, so they leave room for it rather
        // than assuming the script starts at zero.
        let params = ExecutionParams { memory_limit_mb: 128, deadline: Duration::from_millis(1000) };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .unwrap();
        vm.set_publish(Some(8080));
        vm.set_max_life(Some(Duration::from_secs(10)));
        let (tx, rx) = mpsc::channel();
        vm.set_requests(rx);
        let sender = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(800));
            let _ = tx.send(request(9));
        });
        let outcome = vm.run(
            r#"
            fernbox.http.listen("8080", (j) => {
                fernbox.http.respond(String(JSON.parse(j).id), "b2s=");
            });
            fernbox.setTimeout(() => fernbox.http.close(), 1100);
            "up"
            "#,
            &params,
        );
        sender.join().unwrap();
        assert_eq!(outcome, VmOutcome::Completed("up".into()), "renewal should outlive the initial budget");
    }

    #[test]
    fn the_hard_cap_kills_a_renewing_server() {
        use std::sync::mpsc;
        crate::init_v8();
        // Requests keep arriving and renewing, but the 250ms cap is the one
        // thing renewal cannot move: the run dies at the cap regardless.
        let params = ExecutionParams { memory_limit_mb: 128, deadline: Duration::from_millis(100) };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .unwrap();
        vm.set_publish(Some(8080));
        vm.set_max_life(Some(Duration::from_millis(250)));
        let (tx, rx) = mpsc::channel();
        vm.set_requests(rx);
        let sender = std::thread::spawn(move || {
            for i in 0..6 {
                std::thread::sleep(Duration::from_millis(60));
                if tx.send(request(i)).is_err() {
                    break;
                }
            }
        });
        let outcome = vm.run(
            r#"
            fernbox.http.listen("8080", (j) => {
                fernbox.http.respond(String(JSON.parse(j).id), "b2s=");
            });
            "up"
            "#,
            &params,
        );
        sender.join().unwrap();
        assert_eq!(outcome, VmOutcome::TimedOut, "the cap must kill a self-renewing server");
    }

    #[test]
    fn the_http_builtin_serves_a_node_shaped_request() {
        use base64::engine::general_purpose::STANDARD;
        use base64::Engine;
        // A real raw request, framed the way the daemon will forward it, served
        // by `require("http")` rather than the bare chokepoints — so this covers
        // the boot bundle's parsing and serialization, not just the event loop.
        let raw = b"GET /hello HTTP/1.1\r\nHost: localhost\r\n\r\n";
        let request = crate::server::IncomingRequest {
            id: 7,
            raw_b64: STANDARD.encode(raw),
        };
        let (outcome, responses) = serve(
            r#"
            const http = require("http");
            const server = http.createServer((req, res) => {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("hi " + req.url);
            });
            server.listen(8080);
            fernbox.setTimeout(() => server.close(), 200);
            "serving"
            "#,
            Some(8080),
            vec![request],
            2000,
            None,
        );
        assert_eq!(outcome, VmOutcome::Completed("serving".into()));
        assert_eq!(responses.len(), 1);
        assert_eq!(responses[0].0, 7);
        let text = String::from_utf8(STANDARD.decode(&responses[0].1).unwrap()).unwrap();
        assert!(text.starts_with("HTTP/1.1 200 OK\r\n"), "got: {text}");
        assert!(text.contains("Content-Length: 9\r\n"), "got: {text}");
        assert!(text.contains("Connection: close\r\n"), "got: {text}");
        assert!(text.ends_with("\r\n\r\nhi /hello"), "got: {text}");
    }

    #[test]
    fn the_node_core_builtins_load_and_function() {
        // stream/buffer/events are bundled into the boot bundle, so an app gets
        // them without a node_modules of its own — and the global Buffer is the
        // very class the builtin exports, which is what makes Buffer.isBuffer
        // agree with the bytes the http module pushes.
        let value = completed(
            r#"
            const stream = require("stream");
            const { Buffer } = require("buffer");
            const { EventEmitter } = require("events");
            const r = new stream.Readable({ read() {} });
            r.push(Buffer.from("hello"));
            const ee = new EventEmitter();
            let fired = 0;
            ee.on("ping", () => fired++);
            ee.emit("ping");
            JSON.stringify({
                bufferIsGlobal: Buffer === globalThis.Buffer,
                isBuffer: Buffer.isBuffer(Buffer.from("x")),
                bufToString: Buffer.from("hi").toString(),
                readableRead: r.read().toString(),
                instanceofReadable: r instanceof stream.Readable,
                writableIsFunction: typeof stream.Writable === "function",
                eeFired: fired,
                timersAreGlobal: typeof setTimeout === "function" && typeof setImmediate === "function",
            });
        "#,
        );
        let v: serde_json::Value = serde_json::from_str(&value).unwrap();
        assert_eq!(v["bufferIsGlobal"], true, "global Buffer differs from the builtin: {value}");
        assert_eq!(v["isBuffer"], true, "{value}");
        assert_eq!(v["bufToString"], "hi", "{value}");
        assert_eq!(v["readableRead"], "hello", "{value}");
        assert_eq!(v["instanceofReadable"], true, "{value}");
        assert_eq!(v["writableIsFunction"], true, "{value}");
        assert_eq!(v["eeFired"], 1, "{value}");
        assert_eq!(v["timersAreGlobal"], true, "{value}");
    }

    #[test]
    fn the_node_builtin_surface_a_framework_loads() {
        // Every module here is one a framework's dependency tree requires at
        // load time. Presence is half the test; the other half is that the
        // pieces middleware actually calls — inherits, URL parsing, hashes,
        // string decoding — answer like Node's.
        let value = completed(
            r#"
            const assert = require("assert");
            const asyncHooks = require("async_hooks");
            const crypto = require("crypto");
            const diagnostics = require("diagnostics_channel");
            const dns = require("dns");
            const moduleBuiltin = require("module");
            const http = require("http");
            const http2 = require("http2");
            const https = require("https");
            const net = require("net");
            const querystring = require("querystring");
            const stream = require("stream");
            const { StringDecoder } = require("string_decoder");
            const timers = require("timers");
            const tls = require("tls");
            const tty = require("tty");
            const url = require("url");
            const util = require("util");
            const utilTypes = require("util/types");
            const workerThreads = require("worker_threads");
            const zlib = require("zlib");

            function Base() {}
            function Child() { Base.call(this); }
            util.inherits(Child, Base);
            const child = new Child();

            const parsed = new url.URL("http://example.com/a?b=1");
            const decoder = new StringDecoder("utf8");
            const hash = crypto.createHash("sha1").update("abc").digest("hex");
            const hmac = crypto.createHmac("sha256", "key").update("data").digest("hex");

            let tlsRefusal = "no throw";
            try { https.request("https://example.com/"); } catch (e) { tlsRefusal = e.code; }
            let h2Refusal = "no throw";
            try { http2.createServer(); } catch (e) { h2Refusal = e.code; }
            let zlibRefusal = "no throw";
            try { zlib.gzipSync("x"); } catch (e) { zlibRefusal = e.code; }
            let workerRefusal = "no throw";
            try { new workerThreads.Worker("x.js"); } catch (e) { workerRefusal = e.code; }

            const resource = new asyncHooks.AsyncResource("probe");
            const storage = new asyncHooks.AsyncLocalStorage();
            const stored = storage.run("stored", () => storage.getStore());
            const channel = diagnostics.channel("fernbox.probe");
            let published = null;
            channel.subscribe((message) => { published = message; });
            channel.publish("hello");
            const requireFromApp = moduleBuiltin.createRequire("/app/lib/x.js");

            assert.strictEqual(1, 1);
            JSON.stringify({
                assertCallable: typeof assert === "function",
                inherits: child instanceof Base,
                inspect: typeof util.inspect === "function",
                format: util.format("%s-%d", "x", 2),
                typesIsDate: utilTypes.isDate(new Date()),
                urlPath: parsed.pathname + parsed.search,
                urlGlobal: globalThis.URL === url.URL,
                searchParamsGlobal: globalThis.URLSearchParams === url.URLSearchParams,
                legacyParse: url.parse("http://example.com/y").pathname,
                querystring: querystring.stringify({ a: 1 }),
                decoded: decoder.write(Buffer.from("hé")),
                isatty: tty.isatty(1),
                sha1: hash,
                sha256Hmac: hmac,
                zlibConstants: zlib.constants.Z_FINISH === 4 ? "ok" : "wrong",
                zlibRefusal,
                ipv4: net.isIP("127.0.0.1"),
                ipv6: net.isIP("::1"),
                ipNeither: net.isIP("example.com"),
                tlsRefusal,
                h2Refusal,
                timersPromise: typeof timers.promises.setTimeout,
                nodeScheme: require("node:fs") === require("fs"),
                nodeSchemeResolve: require.resolve("node:http"),
                status: http.STATUS_CODES[404],
                methodsIncludeGet: http.METHODS.includes("GET"),
                imReadable: Object.getPrototypeOf(http.IncomingMessage.prototype) === stream.Readable.prototype,
                srWritable: Object.getPrototypeOf(http.ServerResponse.prototype) === stream.Writable.prototype,
                serverIsNetServer: http.Server.prototype instanceof net.Server,
                agent: http.globalAgent instanceof http.Agent,
                clientWritable: http.request({ host: "127.0.0.1", port: 9 }) instanceof stream.Writable,
                socketWritable: new net.Socket().writable,
                asyncScope: resource.runInAsyncScope(() => 42),
                asyncStore: stored,
                diagnosticsDelivered: published,
                diagnosticsSubscribers: channel.hasSubscribers,
                workerRefusal,
                workerIsMain: workerThreads.isMainThread,
                dnsLookup: typeof dns.lookup,
                dnsPromise: typeof dns.promises.lookup,
                moduleIsBuiltin: moduleBuiltin.isBuiltin("http") && moduleBuiltin.isBuiltin("node:zlib"),
                moduleListHasDns: moduleBuiltin.builtinModules.includes("dns"),
                createdResolve: requireFromApp.resolve("http"),
                bufferConstants: require("buffer").constants.MAX_STRING_LENGTH > 0,
                hrtimeBigint: typeof process.hrtime.bigint(),
                hrtimePair: Array.isArray(process.hrtime()),
                queueMicrotask: typeof queueMicrotask,
            });
        "#,
        );
        let v: serde_json::Value = serde_json::from_str(&value).unwrap();
        assert_eq!(v["assertCallable"], true, "{value}");
        assert_eq!(v["inherits"], true, "{value}");
        assert_eq!(v["inspect"], true, "{value}");
        assert_eq!(v["format"], "x-2", "{value}");
        assert_eq!(v["typesIsDate"], true, "{value}");
        assert_eq!(v["urlPath"], "/a?b=1", "{value}");
        assert_eq!(v["urlGlobal"], true, "{value}");
        assert_eq!(v["searchParamsGlobal"], true, "{value}");
        assert_eq!(v["legacyParse"], "/y", "{value}");
        assert_eq!(v["querystring"], "a=1", "{value}");
        assert_eq!(v["decoded"], "hé", "{value}");
        assert_eq!(v["isatty"], false, "{value}");
        assert_eq!(v["sha1"], "a9993e364706816aba3e25717850c26c9cd0d89d", "{value}");
        assert_eq!(
            v["sha256Hmac"], "5031fe3d989c6d1537a013fa6e739da23463fdaec3b70137d828e36ace221bd0",
            "{value}"
        );
        assert_eq!(v["zlibConstants"], "ok", "{value}");
        assert_eq!(v["zlibRefusal"], "ERR_ZLIB_UNSUPPORTED", "{value}");
        assert_eq!(v["ipv4"], 4, "{value}");
        assert_eq!(v["ipv6"], 6, "{value}");
        assert_eq!(v["ipNeither"], 0, "{value}");
        assert_eq!(v["tlsRefusal"], "ERR_TLS_UNSUPPORTED", "{value}");
        assert_eq!(v["h2Refusal"], "ERR_HTTP2_UNSUPPORTED", "{value}");
        assert_eq!(v["timersPromise"], "function", "{value}");
        assert_eq!(v["nodeScheme"], true, "{value}");
        assert_eq!(v["nodeSchemeResolve"], "node:http", "{value}");
        assert_eq!(v["status"], "Not Found", "{value}");
        assert_eq!(v["methodsIncludeGet"], true, "{value}");
        assert_eq!(v["imReadable"], true, "{value}");
        assert_eq!(v["srWritable"], true, "{value}");
        assert_eq!(v["serverIsNetServer"], true, "{value}");
        assert_eq!(v["agent"], true, "{value}");
        assert_eq!(v["clientWritable"], true, "{value}");
        // A live connection is writable in Node, and Koa gates its response on
        // exactly this flag (`ctx.writable`); false would answer nothing at all.
        assert_eq!(v["socketWritable"], true, "{value}");
        assert_eq!(v["asyncScope"], 42, "{value}");
        assert_eq!(v["asyncStore"], "stored", "{value}");
        assert_eq!(v["diagnosticsDelivered"], "hello", "{value}");
        assert_eq!(v["diagnosticsSubscribers"], true, "{value}");
        // A run has one thread; starting another is refused, not faked.
        assert_eq!(v["workerRefusal"], "ERR_WORKER_UNSUPPORTED", "{value}");
        assert_eq!(v["workerIsMain"], true, "{value}");
        // No resolver: the shape exists and answers loopback, and a real query
        // would be refused. Only the shape is asserted here.
        assert_eq!(v["dnsLookup"], "function", "{value}");
        assert_eq!(v["dnsPromise"], "function", "{value}");
        assert_eq!(v["moduleIsBuiltin"], true, "{value}");
        assert_eq!(v["moduleListHasDns"], true, "{value}");
        assert_eq!(v["createdResolve"], "http", "{value}");
        // thread-stream sizes its buffers from this at import.
        assert_eq!(v["bufferConstants"], true, "{value}");
        // pino reads this at import; the shape is what it calls.
        assert_eq!(v["hrtimeBigint"], "bigint", "{value}");
        assert_eq!(v["hrtimePair"], true, "{value}");
        assert_eq!(v["queueMicrotask"], "function", "{value}");
    }

    #[test]
    fn the_http_builtin_serves_a_framework_shaped_handler() {
        use base64::engine::general_purpose::STANDARD;
        use base64::Engine;
        // The middleware contract rather than the chokepoint: a method+url the
        // router reads, headers it matches on, a body streamed through
        // 'data'/'end', and a response built with setHeader/writeHead and
        // written in pieces. If this passes, an Express app has something to
        // stand on.
        let raw = b"POST /submit?x=1 HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"hello\":\"you\"}";
        let request = crate::server::IncomingRequest { id: 21, raw_b64: STANDARD.encode(raw) };
        let (outcome, responses) = serve(
            r#"
            const http = require("http");
            const server = http.createServer((req, res) => {
                const problems = [];
                if (req.method !== "POST") problems.push("method");
                if (req.url !== "/submit?x=1") problems.push("url");
                if (req.headers["content-type"] !== "application/json") problems.push("content-type");
                if (req.socket.remoteAddress !== "127.0.0.1") problems.push("remote");
                if (req.httpVersion !== "1.1") problems.push("version");
                let body = "";
                req.setEncoding("utf8");
                req.on("data", (chunk) => { body += chunk; });
                req.on("end", () => {
                    if (body !== '{"hello":"you"}') problems.push("body:" + body);
                    if (!req.complete) problems.push("complete");
                    res.setHeader("Content-Type", "application/json");
                    res.setHeader("X-Hop", "one");
                    res.removeHeader("X-Hop");
                    if (res.hasHeader("X-Hop")) problems.push("remove");
                    if (res.getHeader("Content-Type") !== "application/json") problems.push("get");
                    res.writeHead(201, { "X-Probe": "ok", "Set-Cookie": ["a=1; Path=/", "b=2; Path=/"] });
                    res.write("part1|");
                    res.end("part2:" + body + ":" + problems.join(","));
                });
            });
            server.listen(8080);
            fernbox.setTimeout(() => server.close(), 200);
            "serving"
            "#,
            Some(8080),
            vec![request],
            2000,
            None,
        );
        assert_eq!(outcome, VmOutcome::Completed("serving".into()));
        assert_eq!(responses.len(), 1);
        let text = String::from_utf8(STANDARD.decode(&responses[0].1).unwrap()).unwrap();
        assert!(text.starts_with("HTTP/1.1 201 Created\r\n"), "got: {text}");
        assert!(text.contains("Content-Type: application/json\r\n"), "got: {text}");
        assert!(text.contains("X-Probe: ok\r\n"), "got: {text}");
        assert_eq!(text.matches("Set-Cookie: ").count(), 2, "got: {text}");
        assert!(text.contains("Content-Length: 28\r\n"), "got: {text}");
        assert!(text.ends_with("\r\n\r\npart1|part2:{\"hello\":\"you\"}:"), "got: {text}");
    }

    #[test]
    fn the_http_builtin_serves_a_koa_shaped_async_handler() {
        use base64::engine::general_purpose::STANDARD;
        use base64::Engine;
        // Koa's dispatcher is an async chain: it awaits a middleware stack and
        // only then calls `res.end`, behind a `ctx.writable` guard that reads
        // `res.socket.writable`. This is the shape that found the stand-in
        // socket claiming not to be writable — the middleware ran and the
        // response was silently never sent.
        let raw = b"GET /async HTTP/1.1\r\nHost: localhost\r\n\r\n";
        let request = crate::server::IncomingRequest { id: 22, raw_b64: STANDARD.encode(raw) };
        let (outcome, responses) = serve(
            r#"
            const http = require("http");
            const server = http.createServer(async (req, res) => {
                const problems = [];
                if (!res.socket.writable) problems.push("socket");
                if (req.url !== "/async") problems.push("url");
                await Promise.resolve();
                await new Promise((resolve) => setTimeout(resolve, 10));
                if (!res.socket.writable) problems.push("socket-after-await");
                res.setHeader("X-Async", "yes");
                res.end("async:" + problems.join(","));
            });
            server.listen(8080);
            fernbox.setTimeout(() => server.close(), 400);
            "serving"
            "#,
            Some(8080),
            vec![request],
            2000,
            None,
        );
        assert_eq!(outcome, VmOutcome::Completed("serving".into()));
        assert_eq!(responses.len(), 1);
        let text = String::from_utf8(STANDARD.decode(&responses[0].1).unwrap()).unwrap();
        assert!(text.starts_with("HTTP/1.1 200 OK\r\n"), "got: {text}");
        assert!(text.contains("X-Async: yes\r\n"), "got: {text}");
        assert!(text.contains("Content-Length: 6\r\n"), "got: {text}");
        assert!(text.ends_with("\r\n\r\nasync:"), "got: {text}");
    }

    #[test]
    fn the_http_client_speaks_to_a_real_server() {
        use base64::engine::general_purpose::STANDARD;
        use base64::Engine;
        use crate::net::NetPolicy;
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::sync::mpsc;
        use std::sync::{Arc, Mutex};

        crate::init_v8();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
            // The body may arrive in a second segment after the head, so read
            // until it shows up rather than trusting one read to hold it all.
            let mut request = String::new();
            let mut buf = [0u8; 4096];
            while !request.contains("payload") {
                let n = stream.read(&mut buf).unwrap();
                if n == 0 {
                    break;
                }
                request.push_str(&String::from_utf8_lossy(&buf[..n]));
            }
            assert!(request.starts_with("POST /probe HTTP/1.1"), "got: {request}");
            assert!(request.contains("payload"), "the client body did not arrive: {request}");
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\nw00t")
                .unwrap();
        });

        // Loopback is opt-in, and this test is the opt-in: it proves the client,
        // not the policy.
        let params = ExecutionParams { memory_limit_mb: 128, deadline: Duration::from_millis(1500) };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy { allow_loopback: true, ..Default::default() })),
        )
        .unwrap();
        vm.set_publish(Some(8080));
        vm.set_max_life(Some(Duration::from_secs(5)));
        let (tx, rx) = mpsc::channel();
        vm.set_requests(rx);
        let sender = std::thread::spawn(move || {
            // After the fetch has done its work and the listener is registered.
            std::thread::sleep(Duration::from_millis(700));
            let _ = tx.send(crate::server::IncomingRequest { id: 33, raw_b64: "R0VUIC8gSFRUUC8xLjE=".into() });
        });

        let collected: Arc<Mutex<Vec<(u64, String)>>> = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&collected);
        vm.set_response_sink(Box::new(move |id, raw| sink.lock().unwrap().push((id, raw))));

        let outcome = vm.run(
            &format!(
                r#"
                const http = require("http");
                const req = http.request(
                    "http://localhost:{port}/probe",
                    {{ method: "POST", headers: {{ "Content-Type": "text/plain" }} }},
                    (res) => {{
                        let body = "";
                        res.on("data", (chunk) => {{ body += chunk; }});
                        res.on("end", () => {{
                            const answer = res.statusCode + ":" + body + ":" + res.headers["content-length"];
                            fernbox.http.listen("8080", (json) => {{
                                const id = JSON.parse(json).id;
                                fernbox.http.respond(String(id), Buffer.from(answer).toString("base64"));
                                fernbox.http.close();
                            }});
                        }});
                    }},
                );
                req.write("payload");
                req.end();
                "client started"
                "#
            ),
            &params,
        );
        sender.join().unwrap();
        server.join().unwrap();
        let responses = collected.lock().unwrap().clone();
        assert_eq!(outcome, VmOutcome::Completed("client started".into()));
        assert_eq!(responses.len(), 1);
        assert_eq!(String::from_utf8(STANDARD.decode(&responses[0].1).unwrap()).unwrap(), "200:w00t:4");
    }

    #[test]
    fn fs_ops_round_trip() {
        // mkdir, readdir, stat, rename, unlink: the full life of a directory
        // entry, each step asserting what the one before it left behind.
        let value = completed(
            r#"
            const fs = fernbox.fs;
            fs.mkdir("/work/sub", { recursive: true });
            if (!fs.exists("/work/sub")) throw new Error("mkdir left no directory");
            if (JSON.parse(fs.readdir("/work")).join(",") !== "sub")
              throw new Error("readdir missed the new entry: " + fs.readdir("/work"));
            const dir = JSON.parse(fs.stat("/work/sub"));
            if (dir.type !== "dir") throw new Error("stat called a directory a " + dir.type);
            fernbox.write("/work/sub/a.txt", "hello");
            const file = JSON.parse(fs.stat("/work/sub/a.txt"));
            if (file.type !== "file" || file.size !== 5)
              throw new Error("wrong file stat: " + JSON.stringify(file));
            fs.rename("/work/sub/a.txt", "/work/sub/b.txt");
            if (fernbox.read("/work/sub/a.txt") !== null) throw new Error("rename left the source behind");
            if (fernbox.read("/work/sub/b.txt") !== "hello") throw new Error("rename lost the contents");
            fs.unlink("/work/sub/b.txt");
            if (fs.exists("/work/sub/b.txt")) throw new Error("unlink left the file behind");
            "round trip ok"
        "#,
        );
        assert_eq!(value, "round trip ok");
    }

    #[test]
    fn rmdir_reports_a_missing_directory() {
        // A refusal carries its code, so a caller's `catch` can tell a missing
        // directory from a non-empty one — the reason `fail` answers JSON.
        let value = completed(
            r#"
            const fs = fernbox.fs;
            const refused = JSON.parse(fs.rmdir("/nonexistent"));
            if (refused.error !== "ENOENT")
              throw new Error("a missing dir should be ENOENT, got " + JSON.stringify(refused));
            fs.mkdir("/empty");
            fs.rmdir("/empty");
            if (fs.exists("/empty")) throw new Error("rmdir left the directory behind");
            "rmdir ok"
        "#,
        );
        assert_eq!(value, "rmdir ok");
    }

    #[test]
    fn mutations_of_image_paths_land_in_the_writable_layer() {
        // `/etc/hosts` is an image file. A mkdir beside it must not touch the
        // image — it shadows, the way a copy-on-write overlay does — and the
        // original has to still read exactly what it always did.
        let value = completed(
            r#"
            const fs = fernbox.fs;
            const before = fernbox.read("/etc/hosts");
            fs.mkdir("/etc/new");
            if (fernbox.read("/etc/hosts") !== before) throw new Error("the image file changed");
            if (!fs.exists("/etc/new")) throw new Error("the new directory is missing");
            "shadowing ok"
        "#,
        );
        assert_eq!(value, "shadowing ok");
    }

    #[test]
    fn a_bare_require_prefers_node_modules_over_a_same_named_app_file() {
        // Node treats only relative and absolute ids as file paths; a bare id
        // is a package name. An app folder's own `express.js` therefore cannot
        // shadow the `express` package, and `require.resolve` must agree.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let image = serde_json::json!({
            "/probe.js": "module.exports = { value: 'app file' };",
            "/node_modules/probe/package.json": "{\"name\":\"probe\"}",
            "/node_modules/probe/index.js": "module.exports = { value: 'package' };",
        });
        let seed = InstanceSeed {
            image: image.to_string(),
            entrypoint: "/main.js".to_string(),
            ..InstanceSeed::empty()
        };
        let mut vm = Vm::new(&params, &seed, Box::new(DirectNet(NetPolicy::default())))
            .expect("the virtual OS booted");
        let outcome = vm.run(
            r#"
            const pkg = require("probe");
            JSON.stringify({ value: pkg.value, resolved: require.resolve("probe") });
            "#,
            &params,
        );
        assert_eq!(
            outcome,
            VmOutcome::Completed(
                r#"{"value":"package","resolved":"/node_modules/probe/index.js"}"#.to_string()
            )
        );
    }

    #[test]
    fn a_mkdir_inside_a_volume_lands_in_that_volume() {
        // The routing `write` uses applies to `mkdir` too, so a directory a
        // script creates inside a mount becomes part of that volume's snapshot
        // and persists. `snapshot` is not on the user API, so the isolate is
        // read back from this side.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let seed = InstanceSeed {
            image: embedded_image_json("base").unwrap().to_string(),
            volumes: r#"[{"mount":"/data","files":{"/data/seed.txt":"seed"}}]"#.to_string(),
            ..InstanceSeed::empty()
        };
        let mut vm = Vm::new(&params, &seed, Box::new(DirectNet(NetPolicy::default())))
            .expect("the virtual OS booted");
        vm.run(
            "fernbox.fs.mkdir('/data/sub'); fernbox.write('/data/sub/keep.txt', 'persisted');",
            &params,
        );

        let snapshot: serde_json::Value = serde_json::from_str(&vm.snapshot().expect("a snapshot"))
            .expect("the snapshot is json");
        let files = snapshot
            .get(0)
            .and_then(|v| v.get("files"))
            .and_then(|v| v.as_object())
            .expect("the /data volume is in the snapshot");
        assert_eq!(files.get("/data/seed.txt").and_then(|v| v.as_str()), Some("seed"));
        assert_eq!(files.get("/data/sub/keep.txt").and_then(|v| v.as_str()), Some("persisted"));
    }

    #[test]
    fn a_volume_mounted_at_root_captures_every_path() {
        // A root mount is the case the segment-boundary rule cannot express:
        // `${mount}/` is `//`, so matching on it captured only the literal `/`
        // and every real path fell through to the writable layer. An image build
        // that writes through a root-mounted volume would lose its files.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let seed = InstanceSeed {
            image: embedded_image_json("base").unwrap().to_string(),
            volumes: r#"[{"mount":"/","files":{}}]"#.to_string(),
            ..InstanceSeed::empty()
        };
        let mut vm = Vm::new(&params, &seed, Box::new(DirectNet(NetPolicy::default())))
            .expect("the virtual OS booted");
        vm.run(
            r#"
            fernbox.write("/etc/hosts", "127.0.0.1 built.example");
            fernbox.fs.mkdir("/usr/local/bin");
            fernbox.write("/usr/local/bin/tool.js", "applet");
            fernbox.write("/app/main.js", "entry");
            "#,
            &params,
        );

        let snapshot: serde_json::Value = serde_json::from_str(&vm.snapshot().expect("a snapshot"))
            .expect("the snapshot is json");
        let files = snapshot
            .get(0)
            .and_then(|v| v.get("files"))
            .and_then(|v| v.as_object())
            .expect("the root volume is in the snapshot");

        // Every path under `/` belongs to the root mount, not just the root.
        assert_eq!(
            files.get("/etc/hosts").and_then(|v| v.as_str()),
            Some("127.0.0.1 built.example"),
        );
        assert_eq!(files.get("/usr/local/bin/tool.js").and_then(|v| v.as_str()), Some("applet"));
        assert_eq!(files.get("/app/main.js").and_then(|v| v.as_str()), Some("entry"));
    }

    #[test]
    fn a_nested_mount_still_wins_over_the_root_mount() {
        // Two volumes can no longer conflict on a prefix: the first match in
        // `volumes` wins, and the daemon validates the mounts it attaches. What
        // must hold is that a root mount does not swallow a nested one, so an
        // image built with both still keeps the nested volume's subtree.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let seed = InstanceSeed {
            image: embedded_image_json("base").unwrap().to_string(),
            volumes: r#"[
                {"mount":"/data","files":{}},
                {"mount":"/","files":{}}
            ]"#
            .to_string(),
            ..InstanceSeed::empty()
        };
        let mut vm = Vm::new(&params, &seed, Box::new(DirectNet(NetPolicy::default())))
            .expect("the virtual OS booted");
        vm.run(
            "fernbox.write('/data/keep.txt', 'in data'); fernbox.write('/etc/hosts', 'root');",
            &params,
        );

        let snapshot: serde_json::Value = serde_json::from_str(&vm.snapshot().expect("a snapshot"))
            .expect("the snapshot is json");
        let data = snapshot.get(0).and_then(|v| v.get("files")).and_then(|v| v.as_object()).unwrap();
        let root = snapshot.get(1).and_then(|v| v.get("files")).and_then(|v| v.as_object()).unwrap();

        assert_eq!(data.get("/data/keep.txt").and_then(|v| v.as_str()), Some("in data"));
        assert_eq!(root.get("/etc/hosts").and_then(|v| v.as_str()), Some("root"));
        // A root mount must not capture the nested volume's subtree.
        assert!(
            root.get("/data/keep.txt").is_none(),
            "the root volume captured a path belonging to /data: {root:?}",
        );
    }

    #[test]
    fn process_identity_reaches_the_user_context() {
        // env, argv, and the entrypoint path land on the user global as data,
        // which is what the boot bundle builds `process` from.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let seed = InstanceSeed {
            image: embedded_image_json("base").unwrap().to_string(),
            env: vec!["FOO=bar".to_string(), "EMPTY=".to_string()],
            argv: vec![
                "node".to_string(),
                "/app/main.js".to_string(),
                "one".to_string(),
            ],
            entrypoint: "/app/main.js".to_string(),
            ..InstanceSeed::empty()
        };
        let mut vm = Vm::new(&params, &seed, Box::new(DirectNet(NetPolicy::default())))
            .expect("the virtual OS booted");
        let outcome = vm.run(
            r#"
            const argv = globalThis.__fernbox_argv;
            const env = globalThis.__fernbox_env;
            if (argv.join(" ") !== "node /app/main.js one") throw new Error("argv: " + argv.join(" "));
            if (env.join(",") !== "FOO=bar,EMPTY=") throw new Error("env: " + env.join(","));
            if (globalThis.__fernbox_entry !== "/app/main.js") throw new Error("entrypoint");
            "identity ok"
        "#,
            &params,
        );
        assert_eq!(outcome, VmOutcome::Completed("identity ok".into()));
    }

    #[test]
    fn the_boot_bundle_gives_the_user_context_a_node_surface() {
        // `require`, `process`, `console`, and a real top-level `__dirname` — the
        // whole point of the bundle, in one script. The entry stays top-level
        // code, so its completion value is still the run's result.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let seed = InstanceSeed {
            image: embedded_image_json("base").unwrap().to_string(),
            env: vec!["FOO=bar".to_string()],
            argv: vec![
                "node".to_string(),
                "/app/main.js".to_string(),
                "one".to_string(),
            ],
            entrypoint: "/app/main.js".to_string(),
            ..InstanceSeed::empty()
        };
        let mut vm = Vm::new(&params, &seed, Box::new(DirectNet(NetPolicy::default())))
            .expect("the virtual OS booted");
        let outcome = vm.run(
            r#"
            const fs = require("fs");
            const path = require("path");
            if (process.argv.slice(2).join(",") !== "one") throw new Error("argv");
            if (process.env.FOO !== "bar") throw new Error("env");
            if (process.cwd() !== "/") throw new Error("cwd");
            if (__filename !== "/app/main.js" || __dirname !== "/app") throw new Error("entry path");
            if (path.join("/a", "b/c", "..") !== "/a/b") throw new Error("path builtin");
            console.log("hello", { a: 1 }, [1, 2]);
            console.error("to stderr");
            fs.writeFileSync("/work/note.txt", "written by require('fs')");
            if (fs.readFileSync("/work/note.txt", "utf8") !== "written by require('fs')")
              throw new Error("the fs builtin did not round trip");
            // `mkdir -p` through the builtin: the options object is stringified
            // exactly once on the way across, so `recursive` survives as a
            // boolean rather than arriving as the text of itself.
            fs.mkdirSync("/work/deep/dir", { recursive: true });
            if (!fs.statSync("/work/deep/dir").isDirectory())
              throw new Error("a recursive mkdir did not create the parents");
            if (require.resolve("/etc/hosts") !== "/etc/hosts") throw new Error("resolve");
            // An id nothing can find is a `MODULE_NOT_FOUND`, not a hang: the
            // file phase and the node_modules walk have to stay separate, or
            // they recurse into each other forever.
            try {
              require("/no/such/module");
              throw new Error("a missing module resolved");
            } catch (err) {
              if (err.code !== "MODULE_NOT_FOUND") throw err;
            }
            "node-shaped ok"
        "#,
            &params,
        );
        assert_eq!(outcome, VmOutcome::Completed("node-shaped ok".into()));
        // `console.log` joins its arguments with spaces and objects through JSON,
        // and `console.error` lands on the other stream.
        assert_eq!(vm.output(), "hello {\"a\":1} [1,2]\n");
        assert_eq!(vm.stderr(), "to stderr\n");
    }

    #[test]
    fn stdio_is_captured_per_run() {
        // The sinks the boot bundle writes through, cleared at the start of each
        // run so one script's output cannot leak into the next.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .expect("the virtual OS booted");
        vm.run("fernbox.stdio.write('first line\\n', 'stdout')", &params);
        assert_eq!(vm.output(), "first line\n");
        vm.run("fernbox.stdio.write('second line\\n', 'stdout')", &params);
        assert_eq!(vm.output(), "second line\n");
    }

    #[test]
    fn a_simulated_shell_runs_the_bin_commands() {
        // `execSync` is a `/bin` shim invoked with its stdio captured, and the
        // whole point is that the code reads like it would under Node.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .expect("the virtual OS booted");
        let outcome = vm.run(
            r#"
            const { execSync, execFileSync } = require("child_process");
            const fs = require("fs");
            if (execSync("echo hello") !== "hello\n") throw new Error("echo");
            // The grammar: a pipe feeds one command's stdout into the next one's
            // stdin, and `;` keeps both commands' output.
            if (execSync("echo a; echo b | cat") !== "a\nb\n") throw new Error("grammar");
            // `&&` short-circuits on a failure, so the command fails with the
            // failing stage's status and prints nothing.
            try {
              execSync("false && echo no");
              throw new Error("a failing command did not throw");
            } catch (err) {
              if (err.status !== 1) throw new Error(`status ${err.status}`);
              if (err.stdout !== "") throw new Error("stdout");
            }
            // A redirect is a write the fs can read back.
            execSync("echo written > /work/redirect.txt");
            if (fs.readFileSync("/work/redirect.txt", "utf8") !== "written\n")
              throw new Error("redirect");
            // An unknown command is a status, the way a real shell reports it,
            // and not a thrown exception with a stack.
            try {
              execSync("no-such-command");
              throw new Error("resolved");
            } catch (err) {
              if (err.status !== 127) throw new Error(`unknown ${err.status}`);
            }
            // `execFileSync` has no grammar, so an argument that looks like an
            // operator is data.
            if (execFileSync("/bin/echo", ["a|b"]) !== "a|b\n") throw new Error("execFileSync");
            "shell ok"
        "#,
            &params,
        );
        assert_eq!(outcome, VmOutcome::Completed("shell ok".into()));
    }

    #[test]
    fn a_child_does_not_disturb_its_parents_process_state() {
        // A child is the same process object with the streams swapped, so the
        // swap has to be exact: a child's `process.exit` must not move the
        // parent's `exitCode`, and its `console.log` must land in the capture.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .expect("the virtual OS booted");
        let outcome = vm.run(
            r#"
            const { execSync } = require("child_process");
            const fs = require("fs");
            // A command the app writes itself, so it can do the two things a
            // child must not leak: log through `console`, and exit with a code.
            fs.writeFileSync(
              "/work/child.js",
              "module.exports = { main() { console.log('from the child'); process.exit(3); } };",
            );
            let status = null;
            try {
              execSync("/work/child.js");
            } catch (err) {
              status = err.status;
              // `console` reads `process.stdout` at write time, which is what
              // lets the swap capture it at all.
              if (err.stdout !== "from the child\n") throw new Error("console not captured");
            }
            if (status !== 3) throw new Error(`child status ${status}`);
            if (process.exitCode !== 0) throw new Error("the child's exit code leaked");
            "child state ok"
        "#,
            &params,
        );
        assert_eq!(outcome, VmOutcome::Completed("child state ok".into()));
        // The child's output was captured, not printed.
        assert_eq!(vm.output(), "");
    }

    #[test]
    fn a_shell_tracks_its_directory_and_input() {
        // `cd` moves the commands that follow it, and `input` reaches the
        // command's stdin — the two things that make a pipeline useful.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .expect("the virtual OS booted");
        let outcome = vm.run(
            r#"
            const { execSync } = require("child_process");
            // `cd` within a line moves the `ls` that follows it in the same line.
            if (execSync("cd /etc && pwd") !== "/etc\n") throw new Error("cd in a line");
            // ...and it does not outlive the command that asked for it.
            if (execSync("pwd") !== "/\n") throw new Error("cd leaked");
            // `cat` with no file reads stdin, which is what closes a pipeline.
            if (execSync("cat", { input: "piped\n" }) !== "piped\n") throw new Error("stdin");
            // A shell reading lines from stdin: the prompt loop, driven by input.
            if (execSync("sh", { input: "echo one\necho two\n" }) !== "one\ntwo\n")
              throw new Error("repl");
            "cwd and stdin ok"
        "#,
            &params,
        );
        assert_eq!(outcome, VmOutcome::Completed("cwd and stdin ok".into()));
    }

    #[test]
    fn piped_stdin_is_the_whole_of_process_stdin() {
        // What the caller piped in is the top level's stdin, read the same way
        // a child reads the `input` an exec hands it — and consumed, so a
        // second read sees EOF rather than the same text again.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let seed = InstanceSeed {
            stdin: "first\nsecond\n".to_string(),
            ..InstanceSeed::embedded("base").unwrap()
        };
        let mut vm = Vm::new(&params, &seed, Box::new(DirectNet(NetPolicy::default())))
            .expect("the virtual OS booted");
        let outcome = vm.run(
            r#"
            const { execSync } = require("child_process");
            // A line at a time, and the buffer drains.
            if (process.stdin.readLine() !== "first") throw new Error("first line");
            if (process.stdin.readLine() !== "second") throw new Error("second line");
            if (process.stdin.readLine() !== null) throw new Error("not EOF");
            // A command without an `input` of its own gets an empty stdin, not
            // the top level's drained one: a child's input is what its caller
            // hands it, never inherited.
            if (execSync("cat") !== "") throw new Error("child inherited drained stdin");
            "piped stdin ok"
        "#,
            &params,
        );
        assert_eq!(outcome, VmOutcome::Completed("piped stdin ok".into()));
    }

    #[test]
    fn a_self_invoking_shell_stops_at_the_depth_cap() {
        // A command that execs itself is a recursion the grammar allows. The
        // deadline bounds it in time; this bounds it in space, and the failure
        // must be a status rather than a `RangeError` that reads like a crash.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .expect("the virtual OS booted");
        let outcome = vm.run(
            r#"
            const { execSync } = require("child_process");
            const fs = require("fs");
            fs.writeFileSync(
              "/work/nest.js",
              "module.exports = { main() { require('child_process').execSync('/work/nest.js'); } };",
            );
            try {
              execSync("/work/nest.js");
              "no cap reached"
            } catch (err) {
              if (err.status !== 126) throw new Error(`capped at ${err.status}`);
              "depth cap ok"
            }
        "#,
            &params,
        );
        assert_eq!(outcome, VmOutcome::Completed("depth cap ok".into()));
    }

    #[test]
    fn a_command_is_run_not_required() {
        // `/bin` holds commands rather than libraries: an app executes `npm`, it
        // does not import it. The refusal is on the resolved path, so the id as
        // spelled makes no difference — and the runner itself still loads the
        // command file, or no command would run at all.
        crate::init_v8();
        let params = ExecutionParams {
            memory_limit_mb: 128,
            deadline: Duration::from_secs(5),
        };
        let mut vm = Vm::new(
            &params,
            &InstanceSeed::embedded("base").unwrap(),
            Box::new(DirectNet(NetPolicy::default())),
        )
        .expect("the virtual OS booted");
        let outcome = vm.run(
            r#"
            const { execSync } = require("child_process");
            // Every spelling of the same command file is refused.
            for (const id of ["/bin/ls.js", "/bin/ls", "./bin/ls"]) {
              let refused = false;
              try {
                require(id);
              } catch (err) {
                refused = err.code === "ERR_REQUIRE_COMMAND";
              }
              if (!refused) throw new Error(`require(${id}) was not refused`);
            }
            // ...and the command still runs, which is what the refusal is for.
            if (!/hostname/.test(execSync("ls /etc"))) throw new Error("ls did not run");
            // A library the app writes itself is unaffected.
            "commands run ok"
        "#,
            &params,
        );
        assert_eq!(outcome, VmOutcome::Completed("commands run ok".into()));
    }

    #[test]
    fn fernos_layers_commands_on_the_base_userland() {
        // A personality's own commands live in a directory the base image does
        // not have, and the PATH finds them there; the commands it inherited are
        // still on the PATH too, because the image layered rather than replaced.
        let value = completed_over(
            r#"
            const fs = require("fs");
            const { execSync } = require("child_process");

            // `/usr/local/bin` is fernos's own, and `head` is a command base does
            // not ship.
            if (execSync("head -n 1 /etc/motd") !== "FernBox 0.1 (fernos)\n")
              throw new Error("head: " + JSON.stringify(execSync("head -n 1 /etc/motd")));
            // `ls` is inherited from base, and still resolves.
            if (!/hostname/.test(execSync("ls /etc"))) throw new Error("the inherited /bin is gone");

            execSync("mkdir -p /work/sub");
            fs.writeFileSync("/work/sub/nums.txt", "3\n1\n2\n");
            if (execSync("sort /work/sub/nums.txt") !== "1\n2\n3\n") throw new Error("sort");
            if (execSync("sort /work/sub/nums.txt | tail -n 1") !== "3\n") throw new Error("tail");
            // `-c` counts the matches rather than printing them.
            if (execSync("grep -c 2 /work/sub/nums.txt") !== "1\n") throw new Error("grep -c");

            // `tee` keeps a copy of what flowed through the pipe it sat in.
            execSync("echo piped | tee /work/sub/tee.txt");
            if (fs.readFileSync("/work/sub/tee.txt", "utf8") !== "piped\n") throw new Error("tee");

            // `env` applies its assignments to the command it runs.
            if (execSync("env FOO=bar printenv FOO") !== "bar\n") throw new Error("env");

            execSync("cp -r /work/sub /work/copy");
            if (!fs.existsSync("/work/copy/nums.txt")) throw new Error("cp -r");
            execSync("touch /work/made.txt");
            if (fs.readFileSync("/work/made.txt", "utf8") !== "") throw new Error("touch");

            // `/usr/bin` is on the PATH by design, and a command an app writes
            // there itself resolves the same way — the middle entry is searched,
            // not just the two an image happens to fill.
            fs.writeFileSync(
              "/usr/bin/mine.js",
              "module.exports = { main: () => { process.stdout.write('mine\\n'); return 0; } };",
            );
            if (execSync("mine") !== "mine\n") throw new Error("the app's /usr/bin command");

            // Every command directory refuses a `require`, not just `/bin`.
            for (const id of ["/usr/local/bin/grep.js", "/bin/ls.js", "/usr/bin/mine.js"]) {
              let refused = false;
              try {
                require(id);
              } catch (err) {
                refused = err.code === "ERR_REQUIRE_COMMAND";
              }
              if (!refused) throw new Error(`require(${id}) was not refused`);
            }
            "fernos ok"
        "#,
            "fernos",
        );
        assert_eq!(value, "fernos ok");
    }

    #[test]
    fn alpine_ships_one_binary_and_applet_shims() {
        // Alpine builds on `minimal`, so it has no inherited userland: the whole
        // of /bin is the multi-call binary and a shim per applet, and the
        // implementations behind them are a library rather than commands.
        let value = completed_over(
            r#"
            const fs = require("fs");
            const { execSync } = require("child_process");

            if (fs.existsSync("/usr/local/bin")) throw new Error("alpine has a /usr/local/bin");

            // A bare name resolves to the shim, which is the applet behind it.
            if (!/Alpine/.test(execSync("cat /etc/os-release"))) throw new Error("the cat applet");
            if (execSync("echo -n quiet") !== "quiet") throw new Error("echo -n through the applet");
            // ...and the binary dispatches an applet named on its own line.
            if (execSync("busybox echo alpine") !== "alpine\n") throw new Error("busybox dispatch");
            // The applets are one shared implementation, so a shim and a direct
            // call agree.
            execSync("mkdir -p /work/box");
            fs.writeFileSync("/work/box/n.txt", "b\na\n");
            if (execSync("sort /work/box/n.txt") !== "a\nb\n") throw new Error("the sort applet");
            // `sh` is an applet too, and it speaks the same grammar as base's.
            if (execSync("sh -c 'echo from sh'") !== "from sh\n") throw new Error("the sh applet");

            // The applets live outside the command directories because a command
            // has to be able to require them; that makes them a library an app
            // can require as well, while a shim is still refused.
            if (typeof require("/usr/lib/busybox/applets.js").cat !== "function")
              throw new Error("the applets are not requirable");
            try {
              require("/bin/cat.js");
              throw new Error("a /bin shim was requirable");
            } catch (err) {
              if (err.code !== "ERR_REQUIRE_COMMAND") throw err;
            }
            "alpine ok"
        "#,
            "alpine",
        );
        assert_eq!(value, "alpine ok");
    }

    #[test]
    fn ubuntu_is_a_personality_not_a_distro() {
        // Ubuntu is identity files over the base userland: the sources list is
        // there because the distribution has one, and no command reads it,
        // because a package manager is a stage of its own.
        let value = completed_over(
            r#"
            const fs = require("fs");
            const { execSync } = require("child_process");

            if (!/Ubuntu/.test(fs.readFileSync("/etc/os-release", "utf8"))) throw new Error("os-release");
            if (fs.readFileSync("/etc/debian_version", "utf8").trim() !== "trixie/sid")
              throw new Error("debian_version");
            if (!fs.existsSync("/etc/apt/sources.list")) throw new Error("the sources list");
            // The commands are base's, unmodified: a personality does not ship a
            // userland of its own unless it says so in its layout.
            if (!/hostname/.test(execSync("ls /etc"))) throw new Error("the base commands are gone");

            let missing = null;
            try {
              execSync("apt list");
            } catch (err) {
              missing = err.status;
            }
            if (missing !== 127) throw new Error(`apt should not exist, got status ${missing}`);
            "ubuntu ok"
        "#,
            "ubuntu",
        );
        assert_eq!(value, "ubuntu ok");
    }
}

