//! The execution host.
//!
//! This is the expendable end of FernBox. The daemon composes a seed from the
//! base image, the app folder, and any attached volumes, then hands it here as
//! bytes over stdin — along with the script and the limits, and nothing else.
//! The worker never learns a host path, a volume name, or a network policy: it
//! boots the isolate, runs the script, and marshals every fetch back to the
//! daemon, which is the sole policy authority.
//!
//! What the worker sees on disk it sees because the daemon read it and put the
//! contents on the pipe. It has no state directory of its own.
//!
//! Two debug modes exist alongside the RPC one: `sandbox` runs a single script
//! in-process, which is what the fixture suite needs, and `probe` reports
//! whether the process restrictions the daemon asked for actually took effect.

use std::io;
use std::process::ExitCode;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::Duration;

use clap::{Parser, Subcommand};

use fernbox_core::{
    init_v8, DirectNet, ExecutionParams, IncomingRequest, InstanceSeed, NetBackend, NetError,
    NetRequest, NetResponse, NetPolicy, Vm, VmOutcome,
};
use fernbox_proto::{
    read_frame, write_frame, FetchReply, OutputStream, WorkerInput, WorkerMessage, WorkerOutcome,
    WorkerRun,
};

mod probe;

/// FernBox worker: runs one isolate per invocation, seeded from stdin.
#[derive(Parser)]
struct Args {
    /// Without a subcommand the worker is in RPC mode: it reads a single
    /// [`WorkerRun`] off stdin, runs it, and writes the outcome back. That is
    /// how the daemon launches it; the subcommands are for debugging.
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Run a single script in-process with no RPC. The fixture suite uses this.
    Sandbox(SandboxArgs),
    /// Report this process's own restrictions. Asserts the daemon's hardening
    /// really applied rather than merely compiling.
    Probe,
}

/// The limits a `sandbox` run is held to.
#[derive(Parser)]
struct SandboxArgs {
    /// Path to the JavaScript file to run.
    script: std::path::PathBuf,
    /// CPU deadline in milliseconds.
    #[arg(long, default_value_t = 1000)]
    deadline_ms: u64,
    /// V8 heap limit in megabytes.
    #[arg(long, default_value_t = 128)]
    memory_mb: usize,
    /// Base image to seed the virtual filesystem from.
    #[arg(long, default_value = "base")]
    image: String,
    /// Allow the sandbox to connect to loopback addresses.
    #[arg(long, default_value_t = false)]
    allow_loopback: bool,
    /// Allow the sandbox to connect to private (RFC 1918) addresses.
    #[arg(long, default_value_t = false)]
    allow_private: bool,
    /// Per-fetch timeout in seconds, covering every redirect hop.
    #[arg(long, default_value_t = 10)]
    net_timeout: u64,
}

fn main() -> ExitCode {
    init_v8();

    match Args::parse().command {
        Some(Command::Sandbox(args)) => sandbox(args),
        Some(Command::Probe) => probe::report(),
        None => run_rpc(),
    }
}

/// RPC mode: one run per process, seeded and reported over stdio.
///
/// Everything the isolate needs arrives as a single frame; the worker answers
/// with fetch requests while the script runs and one `Done` at the end. Nothing
/// else may touch stdout — a stray line there is a frame the daemon will try to
/// parse — so every diagnostic goes to stderr.
fn run_rpc() -> ExitCode {
    let mut stdin = io::stdin();
    let run: WorkerRun = match read_frame::<_, WorkerRun>(&mut stdin) {
        Ok(Some(run)) => run,
        Ok(None) => {
            eprintln!("error: the daemon closed stdin without sending a seed");
            return ExitCode::from(5);
        }
        Err(err) => {
            eprintln!("error: the seed frame could not be read: {err}");
            return ExitCode::from(5);
        }
    };

    let params = ExecutionParams {
        memory_limit_mb: run.memory_limit_mb,
        deadline: Duration::from_millis(run.deadline_ms),
    };
    let seed = InstanceSeed {
        image: run.image,
        volumes: run.volumes,
        env: run.env,
        argv: InstanceSeed::argv_for(&run.entrypoint, &run.args),
        entrypoint: run.entrypoint,
        stdin: run.stdin,
    };

    // The reader thread owns stdin from here on: fetch replies and forwarded
    // requests arrive on it while the script is running, and only after the seed
    // frame is consumed. It sorts them into two channels — a reply unblocks a
    // waiting fetch, a request queues for the run's event loop.
    let (replies, requests) = spawn_reader(stdin);
    let net = StdioNet { replies };

    let mut vm = match Vm::new(&params, &seed, Box::new(net)) {
        Ok(vm) => vm,
        Err(msg) => {
            eprintln!("error: {msg}");
            // The isolate never booted, so nothing was written and there is no
            // snapshot to report. `None` tells the daemon to leave the volumes
            // alone; sending an empty one would erase what they already held.
            return finish(WorkerOutcome::Failed { message: msg }, None);
        }
    };

    // The grant and the cap are the daemon's to give; the worker only enforces
    // them. With no grant, `fernbox.http.listen` refuses; with no cap, the
    // deadline is hard and a plain run keeps its exact old semantics.
    vm.set_publish(run.publish);
    vm.set_max_life(run.max_life_ms.map(Duration::from_millis));
    vm.set_requests(requests);
    // Responses are written here on the run thread, between callbacks — the same
    // thread a fetch writes its frame on — so the two never race for stdout.
    vm.set_response_sink(Box::new(|id, raw_b64| {
        let message = WorkerMessage::HttpResponse { id, raw_b64 };
        if let Err(err) = write_frame(&mut io::stdout(), &message) {
            eprintln!("error: the response frame could not be written: {err}");
        }
    }));
    // Output streams out as the script writes it, so a caller watching a long
    // run is not left staring at a blank terminal until it ends. The frames are
    // best-effort: if one cannot be written the run continues, because `Done`
    // still carries the whole of stdout as the fallback copy.
    vm.set_output_sink(Box::new(|text, is_stdout| {
        let message = WorkerMessage::Stdout {
            text: text.to_string(),
            stream: if is_stdout { OutputStream::Stdout } else { OutputStream::Stderr },
        };
        let _ = write_frame(&mut io::stdout(), &message);
    }));

    let outcome = vm.run(&run.script, &params);
    // The snapshot is the worker's only output besides the outcome, and a run
    // that compiled may well have written — the daemon decides what persists.
    let snapshot = vm.snapshot().ok();
    let output = vm.output().to_string();
    let ran = matches!(
        outcome,
        VmOutcome::Completed(_) | VmOutcome::TimedOut | VmOutcome::OutOfMemory | VmOutcome::Threw(_)
    );
    finish(
        outcome_of(outcome, &output),
        ran.then_some(snapshot.unwrap_or_default()),
    )
}

/// Write the final frame and exit. A run that compiled reports its volumes; one
/// that never got going reports none.
fn finish(outcome: WorkerOutcome, volumes: Option<String>) -> ExitCode {
    let message = WorkerMessage::Done { outcome, volumes };
    match write_frame(&mut io::stdout(), &message) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("error: the outcome frame could not be written: {err}");
            ExitCode::from(6)
        }
    }
}

/// Serve fetches by round-tripping them to the daemon.
///
/// The worker holds no policy, so it cannot decide what it is allowed to reach
/// — it hands the request and its remaining budget over and takes what comes
/// back. The budget bounds the wait, which is the whole point: a hung daemon
/// ends the run at the script's deadline rather than parking the isolate
/// forever, and the policy timeout on the daemon's side is the ceiling.
struct StdioNet {
    replies: mpsc::Receiver<io::Result<FetchReply>>,
}

/// Start the background reader that sorts stdin into fetch replies and forwarded
/// requests. Both channels close when the pipe does: a waiting fetch sees a
/// disconnect, and the event loop stops parking on a request source that is gone.
fn spawn_reader(
    mut stdin: io::Stdin,
) -> (
    mpsc::Receiver<io::Result<FetchReply>>,
    mpsc::Receiver<IncomingRequest>,
) {
    let (fetch_tx, fetch_rx) = mpsc::channel();
    let (request_tx, request_rx) = mpsc::channel();
    std::thread::spawn(move || loop {
        match read_frame::<_, WorkerInput>(&mut stdin) {
            Ok(Some(WorkerInput::Fetch(reply))) => {
                if fetch_tx.send(Ok(reply)).is_err() {
                    // The isolate is done; nobody is listening anymore.
                    break;
                }
            }
            Ok(Some(WorkerInput::HttpRequest { id, raw_b64 })) => {
                if request_tx.send(IncomingRequest { id, raw_b64 }).is_err() {
                    break;
                }
            }
            Ok(None) => break,
            Err(err) => {
                let _ = fetch_tx.send(Err(err));
                break;
            }
        }
    });
    (fetch_rx, request_rx)
}

impl NetBackend for StdioNet {
    fn fetch(
        &mut self,
        hosts: &str,
        request: &NetRequest,
        budget: Duration,
    ) -> Result<NetResponse, NetError> {
        let message = WorkerMessage::Fetch {
            hosts: hosts.to_string(),
            url: request.url.clone(),
            method: request.method.clone(),
            headers: request.headers.clone(),
            body: request.body.clone(),
            budget_ms: budget.as_millis().min(u64::MAX as u128) as u64,
        };
        write_frame(&mut io::stdout(), &message).map_err(transport)?;

        match self.replies.recv_timeout(budget) {
            Ok(Ok(reply)) => match (reply.result, reply.error) {
                (Some(value), None) => serde_json::from_value(value)
                    .map_err(|err| NetError::Transport(format!("the daemon's reply was not a response: {err}"))),
                (None, Some(message)) => Err(decode_refusal(&message)),
                // Exactly one half is set by construction; anything else is a
                // broken peer, and treating it as a refusal would lie about why.
                _ => Err(NetError::Transport("the daemon's fetch reply was empty".into())),
            },
            Ok(Err(err)) => Err(transport(err)),
            // The clamp: the wait ends with the run's budget, not the peer's
            // patience. The script sees a timeout and the watchdog does the rest.
            Err(RecvTimeoutError::Timeout) => Err(NetError::Timeout),
            Err(RecvTimeoutError::Disconnected) => {
                Err(NetError::Transport("the daemon stopped answering".into()))
            }
        }
    }
}

/// The daemon reports refusals as text rather than an error code, because the
/// policy layer's reasons are meant for the script to read.
fn decode_refusal(message: &str) -> NetError {
    if message == NetError::Timeout.message() {
        NetError::Timeout
    } else if message == NetError::HostNotFound.message() {
        NetError::HostNotFound
    } else if message == NetError::TooManyRedirects.message() {
        NetError::TooManyRedirects
    } else if message == NetError::BodyTooLarge.message() {
        NetError::BodyTooLarge
    } else if let Some(reason) = message.strip_prefix("denied: ") {
        NetError::Denied(reason.to_string())
    } else if let Some(reason) = message.strip_prefix("bad url: ") {
        NetError::BadUri(reason.to_string())
    } else {
        NetError::Transport(message.to_string())
    }
}

fn transport(err: io::Error) -> NetError {
    NetError::Transport(format!("the worker channel broke: {err}"))
}

/// The sandbox's outcome, as the wire sees it.
fn outcome_of(outcome: VmOutcome, output: &str) -> WorkerOutcome {
    match outcome {
        VmOutcome::Completed(value) => WorkerOutcome::Completed { value, output: output.to_string() },
        VmOutcome::TimedOut => WorkerOutcome::TimedOut,
        VmOutcome::OutOfMemory => WorkerOutcome::OutOfMemory,
        VmOutcome::Threw(message) => WorkerOutcome::Threw { message },
        VmOutcome::Failed(message) => WorkerOutcome::Failed { message },
    }
}

/// In-process execution for a single script: the fixture path, and the quickest
/// way to check the isolate itself still behaves.
fn sandbox(args: SandboxArgs) -> ExitCode {
    let source = match std::fs::read_to_string(&args.script) {
        Ok(source) => source,
        Err(err) => {
            eprintln!("error: cannot read {}: {err}", args.script.display());
            return ExitCode::from(3);
        }
    };

    let params = ExecutionParams {
        memory_limit_mb: args.memory_mb,
        deadline: Duration::from_millis(args.deadline_ms),
    };
    let seed = match InstanceSeed::embedded(&args.image) {
        Ok(seed) => seed,
        Err(msg) => {
            eprintln!("error: {msg}");
            return ExitCode::from(5);
        }
    };

    let policy = NetPolicy {
        allow_loopback: args.allow_loopback,
        allow_private: args.allow_private,
        request_timeout: Duration::from_secs(args.net_timeout),
        ..NetPolicy::default()
    };

    let mut vm = match Vm::new(&params, &seed, Box::new(DirectNet(policy))) {
        Ok(vm) => vm,
        Err(msg) => {
            eprintln!("error: {msg}");
            return ExitCode::from(5);
        }
    };

    match vm.run(&source, &params) {
        VmOutcome::Completed(value) => {
            println!("completed: {value}");
            ExitCode::SUCCESS
        }
        VmOutcome::TimedOut => {
            eprintln!("terminated: exceeded {}ms deadline", args.deadline_ms);
            ExitCode::from(2)
        }
        VmOutcome::OutOfMemory => {
            eprintln!("terminated: exceeded {}MB heap limit", args.memory_mb);
            ExitCode::from(4)
        }
        VmOutcome::Threw(msg) => {
            eprintln!("threw: {msg}");
            ExitCode::from(1)
        }
        VmOutcome::Failed(msg) => {
            eprintln!("failed: {msg}");
            ExitCode::from(1)
        }
    }
}
