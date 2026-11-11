//! FernBox's daemon: the trust root, and nothing else.
//!
//! It owns the state directory, the network policy, and the right to spawn a
//! worker. It does not run untrusted code — no isolate is booted here, and no
//! V8 platform is initialised — because a V8 escape costs the process holding
//! the keys, and this is the process holding them. Every run is a worker child
//! process, sandboxed at creation and expendable by design.
//!
//! Two ways in: the local subcommands (`run`, `images`, `volumes`, `inspect`,
//! `commit`), which are the same handlers the server uses, and `serve`, which
//! puts them on a loopback socket behind a token. `sandbox` moved to the worker
//! in Stage 5b — the daemon has no execution path left to expose.

use std::io::{self, IsTerminal, Read};
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Duration;

use clap::{Parser, Subcommand};

use fernbox_core::{available_embedded_images, embedded_image_json, FsPolicy, NetPolicy};

use fernbox_proto::{ClientRequest, DaemonResponse, Limits, NetFlags, VolumeSpec};

use crate::state::{compose_seed, load_file_map, parse_volume_spec, Daemon, FileMap, StateDir};

mod frame;
mod gate;
mod serve;
mod spawn;
mod state;
mod worker;

/// The hard lifetime cap a serving run gets when the caller names none. A
/// service may renew its idle budget on every request, but not past this: an
/// hour is long enough to be useful and short enough that a forgotten run still
/// ends. A plain (non-serving) run ignores it — its deadline is already hard.
const DEFAULT_MAX_LIFE_MS: u64 = 3_600_000;

/// FernBox: run untrusted JavaScript inside a hard-limited sandbox.
#[derive(Parser)]
struct Args {
    /// Use this directory instead of `~/.fernbox`. Handy for throwaway state in
    /// tests; it must already be a path you are willing to let the daemon write.
    #[arg(long, global = true)]
    state_dir: Option<String>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Listen on loopback and serve requests from a client. The CLI talks to
    /// this; without it running, there is nothing to connect to.
    Serve(ServeArgs),
    /// Run an app folder: it loads as a read-only layer over a base image, and
    /// attached volumes persist their contents across runs.
    Run(AppArgs),
    /// List the base images on disk and bundled into the binary.
    Images(EmptyArgs),
    /// List the named volumes holding persistent state.
    Volumes(EmptyArgs),
    /// Show the files inside a volume as a tree.
    Inspect(InspectArgs),
    /// Freeze a volume into a new base image under the state directory.
    Commit(CommitArgs),
}

#[derive(Parser)]
struct InspectArgs {
    /// The volume to look inside.
    volume: String,
}

#[derive(Parser)]
struct EmptyArgs {}

/// Where to listen. No `--port` means the OS assigns one, so two daemons never
/// collide and there is no well-known port for a sandbox to aim at.
#[derive(Parser)]
struct ServeArgs {
    /// Bind this port instead of one the operating system picks.
    #[arg(long)]
    port: Option<u16>,
    /// How many runs may execute at once; the rest wait in a queue rather than
    /// failing. Must be at least one — zero would wait forever.
    #[arg(long, default_value_t = 4)]
    max_runs: usize,
}

#[derive(Parser)]
struct AppArgs {
    /// The app folder to load as a read-only layer over the base image.
    app_dir: PathBuf,
    /// The file inside the app folder to run.
    #[arg(long, default_value = "main.js")]
    entrypoint: String,
    /// Base image to layer the app folder over. A committed image of the same
    /// name shadows the built-in one.
    #[arg(long, default_value = "base")]
    image: String,
    /// Attach a persistent volume, as `NAME:MOUNT`. Repeatable; the mount is
    /// the only subtree that survives the run.
    #[arg(long = "volume", value_name = "NAME:MOUNT")]
    volumes: Vec<String>,
    /// CPU deadline in milliseconds.
    #[arg(long, default_value_t = 5000)]
    deadline_ms: u64,
    /// V8 heap limit in megabytes.
    #[arg(long, default_value_t = 128)]
    memory_mb: usize,
    /// Grant this loopback port for the run to serve on. The daemon binds
    /// 127.0.0.1:PORT and forwards what arrives; without it, listening is
    /// refused. The grant is the allowlist — the port is open on loopback.
    #[arg(long, value_name = "PORT")]
    publish: Option<u16>,
    /// Hard lifetime cap in milliseconds for a serving run: the latest instant
    /// activity may renew the idle deadline to. Defaults to one hour when a port
    /// is published; ignored otherwise, where the deadline is already hard.
    #[arg(long, value_name = "MS")]
    max_life_ms: Option<u64>,
    /// Allow the sandbox to connect to loopback addresses.
    #[arg(long, default_value_t = false)]
    allow_loopback: bool,
    /// Allow the sandbox to connect to private (RFC 1918) addresses.
    #[arg(long, default_value_t = false)]
    allow_private: bool,
    /// Per-fetch timeout in seconds, covering every redirect hop.
    #[arg(long, default_value_t = 10)]
    net_timeout: u64,
    /// Set an environment variable, as `KEY=VALUE`. Repeatable; the sandbox
    /// never sees the host's environment, only these.
    #[arg(long = "env", value_name = "KEY=VALUE")]
    env: Vec<String>,
    /// Arguments after the entrypoint. `process.argv` sees them at index 2.
    #[arg(last = true)]
    args: Vec<String>,
}

#[derive(Parser)]
struct CommitArgs {
    /// The volume to freeze.
    volume: String,
    /// The image name to write it under.
    image: String,
    /// The base image the frozen state is layered over. A committed image of the
    /// same name shadows a built-in one.
    #[arg(long, default_value = "base")]
    from: String,
}

/// Resolve the state directory, or report why it cannot be found.
pub fn state_dir(override_dir: Option<&str>) -> Result<StateDir, ExitCode> {
    match StateDir::resolve(override_dir) {
        Ok(state) => Ok(state),
        Err(msg) => {
            eprintln!("error: {msg}");
            Err(ExitCode::from(5))
        }
    }
}

/// Resolve a state directory with the locks a concurrent daemon needs. The
/// local subcommands are single requests, but they share `handle` with the
/// server, so they take the same locks — a throwaway `Daemon` with one caller
/// never contends with anything.
pub fn daemon(override_dir: Option<&str>) -> Result<Daemon, ExitCode> {
    Ok(Daemon::new(state_dir(override_dir)?))
}

fn main() -> ExitCode {
    let args = Args::parse();

    match args.command {
        Command::Serve(serve) => {
            // A zero slot semaphore admits no one and waits forever, which is a
            // configuration error rather than a daemon that serves nothing.
            if serve.max_runs == 0 {
                eprintln!("error: --max-runs must be at least 1");
                return ExitCode::from(2);
            }
            serve::serve(args.state_dir.as_deref(), serve.port, serve.max_runs)
        }
        Command::Run(app) => {
            let daemon = match daemon(args.state_dir.as_deref()) {
                Ok(daemon) => daemon,
                Err(code) => return code,
            };
            // The wire requires an absolute path; the local subcommand resolves
            // one itself so `run fixtures/apps/counter` works from anywhere.
            let app_dir = match absolute_dir(&app.app_dir) {
                Ok(dir) => dir,
                Err(code) => return code,
            };
            let volumes = match parse_volumes(&app.volumes) {
                Ok(volumes) => volumes,
                Err(code) => return code,
            };
            let stdin = match piped_stdin() {
                Ok(stdin) => stdin,
                Err(code) => return code,
            };
            print_response(handle(
                &daemon,
                ClientRequest::Run {
                    app_dir,
                    entrypoint: app.entrypoint,
                    image: app.image,
                    volumes,
                    limits: Limits {
                        deadline_ms: app.deadline_ms,
                        memory_mb: app.memory_mb,
                        max_life_ms: app.max_life_ms,
                    },
                    net: NetFlags {
                        allow_loopback: app.allow_loopback,
                        allow_private: app.allow_private,
                        net_timeout: app.net_timeout,
                    },
                    env: app.env,
                    args: app.args,
                    stdin,
                    publish: app.publish,
                },
            ))
        }
        Command::Images(_) => {
            let daemon = match daemon(args.state_dir.as_deref()) {
                Ok(daemon) => daemon,
                Err(code) => return code,
            };
            print_response(handle(&daemon, ClientRequest::Images))
        }
        Command::Volumes(_) => {
            let daemon = match daemon(args.state_dir.as_deref()) {
                Ok(daemon) => daemon,
                Err(code) => return code,
            };
            print_response(handle(&daemon, ClientRequest::Volumes))
        }
        Command::Inspect(inspect) => {
            let daemon = match daemon(args.state_dir.as_deref()) {
                Ok(daemon) => daemon,
                Err(code) => return code,
            };
            print_response(handle(
                &daemon,
                ClientRequest::VolumeFiles { volume: inspect.volume },
            ))
        }
        Command::Commit(commit) => {
            let daemon = match daemon(args.state_dir.as_deref()) {
                Ok(daemon) => daemon,
                Err(code) => return code,
            };
            print_response(handle(
                &daemon,
                ClientRequest::Commit {
                    volume: commit.volume,
                    image: commit.image,
                    from: commit.from,
                },
            ))
        }
    }
}

/// An app folder as an absolute path, or why it will not do. Canonicalising also
/// resolves the `..` a relative path might carry, so nothing about the host's
/// layout reaches the worker except the bytes the daemon read.
fn absolute_dir(path: &Path) -> Result<String, ExitCode> {
    match std::fs::canonicalize(path) {
        Ok(dir) => dir.to_str().map(str::to_string).ok_or_else(|| {
            eprintln!("error: app folder {} is not valid utf8", path.display());
            ExitCode::from(3)
        }),
        Err(err) => {
            eprintln!("error: app folder {} cannot be read: {err}", path.display());
            Err(ExitCode::from(3))
        }
    }
}

/// What the caller piped in, as the app's stdin. A terminal is left alone —
/// reading one would block on a caller who may never be done typing — so the
/// local `run` answers an empty stdin unless something was piped.
fn piped_stdin() -> Result<String, ExitCode> {
    if io::stdin().is_terminal() {
        return Ok(String::new());
    }
    let mut buf = String::new();
    match io::stdin().read_to_string(&mut buf) {
        Ok(_) => Ok(buf),
        Err(err) => {
            eprintln!("error: cannot read stdin: {err}");
            Err(ExitCode::from(3))
        }
    }
}

/// Turn `NAME:MOUNT` specs into pairs, or report the first one that is wrong.
fn parse_volumes(specs: &[String]) -> Result<Vec<VolumeSpec>, ExitCode> {
    let mut volumes = Vec::with_capacity(specs.len());
    for spec in specs {
        match parse_volume_spec(spec) {
            Ok((name, mount)) => volumes.push(VolumeSpec { name, mount }),
            Err(msg) => {
                eprintln!("error: {msg}");
                return Err(ExitCode::from(3));
            }
        }
    }
    Ok(volumes)
}

/// Handle one request. This is the whole daemon surface, shared by the local
/// subcommands and the server, so there is exactly one implementation of each.
pub fn handle(daemon: &Daemon, request: ClientRequest) -> DaemonResponse {
    let state = daemon.state();
    match request {
        ClientRequest::Auth { .. } => DaemonResponse::Err {
            message: "auth is the first frame, not a request".into(),
        },
        ClientRequest::Run { app_dir, entrypoint, image, volumes, limits, net, env, args, stdin, publish } => {
            run_app(daemon, &app_dir, &entrypoint, &image, &volumes, &limits, &net, &env, &args, &stdin, publish)
        }
        ClientRequest::Images => match state.list_images() {
            Ok(on_disk) => DaemonResponse::Images { sources: image_sources(on_disk) },
            Err(msg) => DaemonResponse::Err { message: msg },
        },
        ClientRequest::Volumes => match state.list_volumes() {
            Ok(names) => DaemonResponse::Volumes { names },
            Err(msg) => DaemonResponse::Err { message: msg },
        },
        ClientRequest::VolumeFiles { volume } => match state.volume_entries(&volume) {
            Ok(files) => DaemonResponse::VolumeFiles { volume, files },
            Err(msg) => DaemonResponse::Err { message: msg },
        },
        ClientRequest::Commit { volume, image, from } => {
            commit_volume(daemon, &volume, &image, &from)
        }
    }
}

/// The effective image list: a committed image on disk shadows a bundled one of
/// the same name, so a name printed once is the one a run would use.
fn image_sources(on_disk: Vec<String>) -> Vec<(String, String)> {
    let mut names = on_disk.clone();
    for embedded in available_embedded_images() {
        if !names.iter().any(|n| n == embedded) {
            names.push(embedded.to_string());
        }
    }
    names.sort();
    names
        .into_iter()
        .map(|name| {
            let source = if on_disk.iter().any(|n| n == &name) { "disk" } else { "bundled" };
            (name, source.to_string())
        })
        .collect()
}

fn run_app(
    daemon: &Daemon,
    app_dir: &str,
    entrypoint: &str,
    image: &str,
    volumes: &[VolumeSpec],
    limits: &Limits,
    net: &NetFlags,
    env: &[String],
    args: &[String],
    stdin: &str,
    publish: Option<u16>,
) -> DaemonResponse {
    let state = daemon.state();
    let app_dir = Path::new(app_dir);
    if !app_dir.is_absolute() || !app_dir.is_dir() {
        return DaemonResponse::Err {
            message: format!("app folder {} does not exist", app_dir.display()),
        };
    }
    if let Some(dup) = first_duplicate(volumes.iter().map(|v| &v.mount)) {
        return DaemonResponse::Err { message: format!("two volumes are mounted at {dup}") };
    }

    // Image locks always precede volume ones, and this one is a short section —
    // the directory read only, released before the worker starts — so a commit
    // can never freeze out a run that is merely reading a base image, and no
    // run holds an image lock while waiting on a volume.
    let image_lock = daemon.lock_image(image);
    let _image_guard = image_lock.hold();
    let base_json = match base_image_json(state, image, embedded_image_json(image)) {
        Ok(json) => json,
        Err(msg) => return DaemonResponse::Err { message: msg },
    };
    drop(_image_guard);

    // The volume locks are held to the end of the run, because the critical
    // section is the whole read→run→write: two runs on one volume would
    // otherwise each read the prior count and each write the same next one.
    let volume_locks = daemon.lock_volumes(&volumes.iter().map(|v| v.name.clone()).collect::<Vec<_>>());
    let _volume_guards = volume_locks.hold();

    let entrypoint_path = app_dir.join(entrypoint);
    let script = match std::fs::read_to_string(&entrypoint_path) {
        Ok(script) => script,
        Err(err) => {
            return DaemonResponse::Err {
                message: format!("cannot read {}: {err}", entrypoint_path.display()),
            }
        }
    };
    // The virtual path the module layer sees the entrypoint at. A `..` component
    // would name somewhere outside the app folder, which is not the client's to
    // read and would also give the top level a `__dirname` that does not exist.
    if !entrypoint_path.starts_with(app_dir) {
        return DaemonResponse::Err {
            message: format!("entrypoint {entrypoint} is outside the app folder"),
        };
    }

    let app_files = match load_file_map(app_dir) {
        Ok(files) => files,
        Err(msg) => return DaemonResponse::Err { message: msg },
    };

    // Each volume's prior contents ride along in the seed; an empty volume is an
    // empty mount, so a fresh volume is indistinguishable from a used one.
    let mut volume_files: Vec<(String, FileMap)> = Vec::with_capacity(volumes.len());
    for volume in volumes {
        match state.load_volume(&volume.name) {
            Ok(files) => volume_files.push((volume.mount.clone(), files)),
            Err(msg) => return DaemonResponse::Err { message: msg },
        }
    }

    let policy = FsPolicy::default();
    let seed = match compose_seed(&base_json, &app_files, &volume_files, &policy) {
        Ok(seed) => seed,
        Err(msg) => return DaemonResponse::Err { message: msg },
    };

    let net = NetPolicy {
        allow_loopback: net.allow_loopback,
        allow_private: net.allow_private,
        request_timeout: Duration::from_secs(net.net_timeout),
        ..NetPolicy::default()
    };
    // The virtual path of the entrypoint: the app folder layers at `/`, so
    // `main.js` is `/main.js`. The module layer uses it for the top level's
    // `__dirname`, and relative requires from the entry resolve against it.
    let virtual_entry = virtual_path(app_dir, &entrypoint_path);
    // A serving run with no explicit cap still gets one: without a ceiling,
    // renewal would keep a service alive forever, and the idle deadline alone
    // would kill one that is merely idle between requests. An hour is the
    // default the CLI mirrors; a plain run keeps its hard deadline untouched.
    let max_life_ms = limits.max_life_ms.or(publish.map(|_| DEFAULT_MAX_LIFE_MS));
    let run = fernbox_proto::WorkerRun {
        image: seed.image,
        volumes: seed.volumes,
        script,
        entrypoint: virtual_entry,
        env: env.to_vec(),
        args: args.to_vec(),
        stdin: stdin.to_string(),
        memory_limit_mb: limits.memory_mb,
        deadline_ms: limits.deadline_ms,
        publish,
        max_life_ms,
    };

    let mut worker = match worker::Worker::start(&run) {
        Ok(worker) => worker,
        Err(err) => {
            return DaemonResponse::Err {
                message: format!("cannot spawn the worker: {err}"),
            }
        }
    };
    let id = worker.id();
    let (outcome, snapshot) = match worker.finish(&net) {
        Ok(pair) => pair,
        Err(err) => {
            return DaemonResponse::Err {
                message: format!("worker {id} did not report: {err}"),
            }
        }
    };

    let response = match outcome {
        fernbox_proto::WorkerOutcome::Completed { value, output } => DaemonResponse::Ok { value, output },
        fernbox_proto::WorkerOutcome::Threw { message } => DaemonResponse::Threw { message },
        fernbox_proto::WorkerOutcome::Failed { message } => DaemonResponse::Failed { message },
        fernbox_proto::WorkerOutcome::TimedOut => DaemonResponse::TimedOut,
        fernbox_proto::WorkerOutcome::OutOfMemory => DaemonResponse::OutOfMemory,
    };

    // A run that got as far as executing keeps its volume writes — the way a
    // container does — and one that never booted changes nothing. `None` is the
    // worker saying there was no isolate to snapshot from. The volume locks are
    // still held here, which is what makes the snapshot atomic against another
    // run on the same volume.
    let ran = !matches!(response, DaemonResponse::Failed { .. });
    if ran {
        if let Some(snapshot) = snapshot {
            if let Err(msg) = snapshot_volumes(&snapshot, state, volumes, &policy) {
                return DaemonResponse::Err { message: msg };
            }
        }
    }
    response
}

/// The path an app-folder file sits at inside the sandbox: the folder layers at
/// `/`, so the entrypoint's host path becomes a posix virtual one. Host
/// separators are normalised so the same folder loads identically everywhere.
fn virtual_path(app_dir: &Path, file: &Path) -> String {
    match file.strip_prefix(app_dir) {
        Ok(relative) => {
            let mut path = String::from("/");
            let mut first = true;
            for part in relative.components() {
                use std::path::Component::*;
                let part = match part {
                    Normal(part) => part,
                    CurDir => continue,
                    // Prefix and RootDir cannot appear under a stripped prefix;
                    // ParentDir is excluded by the `starts_with` check above.
                    _ => continue,
                };
                if !first {
                    path.push('/');
                }
                path.push_str(&part.to_string_lossy());
                first = false;
            }
            path
        }
        // Unreachable for a file the `starts_with` check already accepted; the
        // fallback keeps the function total rather than panicking on a caller
        // that skips it.
        Err(_) => "/main.js".to_string(),
    }
}

/// Pull the volume layers out of the worker's report and put them back on disk.
/// Every volume is checked for size before any is written, so a quota failure
/// leaves the set on disk as it was rather than half-replaced. The report is
/// untrusted: it comes from a process that ran untrusted code.
fn snapshot_volumes(
    snapshot_json: &str,
    state: &StateDir,
    volumes: &[VolumeSpec],
    policy: &FsPolicy,
) -> Result<(), String> {
    if volumes.is_empty() {
        return Ok(());
    }

    let layers: Vec<serde_json::Value> = serde_json::from_str(snapshot_json)
        .map_err(|err| format!("the worker's snapshot is not a volume list: {err}"))?;

    let mut stored: Vec<(String, String)> = Vec::new();
    for volume in volumes {
        let layer = layers
            .iter()
            .find(|layer| layer.get("mount").and_then(|m| m.as_str()) == Some(volume.mount.as_str()));
        let Some(files) = layer.and_then(|l| l.get("files")) else {
            return Err(format!("the snapshot has no mount `{}`", volume.mount));
        };
        let files: FileMap = serde_json::from_value(files.clone())
            .map_err(|err| format!("mount `{}` did not snapshot as a file map: {err}", volume.mount))?;
        stored.push((volume.name.clone(), state.volume_json(&volume.name, &files, policy)?));
    }

    for (name, json) in &stored {
        state.write_volume(name, json)?;
    }
    Ok(())
}

/// The base image's file map: a committed image on disk wins over a built-in of
/// the same name, because that is what `commit` is for.
fn base_image_json<'a>(
    state: &StateDir,
    image: &str,
    embedded: Option<&'a str>,
) -> Result<std::borrow::Cow<'a, str>, String> {
    if let Some(files) = state.load_image(image)? {
        return Ok(std::borrow::Cow::Owned(serde_json::to_string(&files).map_err(|err| {
            format!("cannot encode image `{image}`: {err}")
        })?));
    }
    embedded
        .map(std::borrow::Cow::Borrowed)
        .ok_or_else(|| format!("no image named `{image}` on disk or bundled into the binary"))
}

/// Freeze a volume over a base image. The base is looked up the same way a run
/// looks one up, so a committed image can carry another committed image.
///
/// The image lock is taken before the volume one — the same order every other
/// path uses — and both cover the read and the write, so a commit cannot read a
/// half-written volume or race a run that is snapshotting one.
fn commit_volume(daemon: &Daemon, volume: &str, image: &str, from: &str) -> DaemonResponse {
    let state = daemon.state();
    let image_lock = daemon.lock_image(image);
    let _image_guard = image_lock.hold();
    let volume_locks = daemon.lock_volumes(&[volume.to_string(), from.to_string()]);
    let _volume_guards = volume_locks.hold();

    let base_json = match base_image_json(state, from, embedded_image_json(from)) {
        Ok(json) => json,
        Err(msg) => return DaemonResponse::Err { message: msg },
    };
    match state.commit_volume(volume, image, &base_json, &FsPolicy::default()) {
        Ok(()) => DaemonResponse::Ok {
            value: format!("committed volume `{volume}` to image `{image}`"),
            output: String::new(),
        },
        Err(msg) => DaemonResponse::Err { message: msg },
    }
}

/// Print a response the way the local subcommands always have, and turn it into
/// the exit code that matches it.
fn print_response(response: DaemonResponse) -> ExitCode {
    match response {
        DaemonResponse::Ok { value, output } => {
            println!("completed: {value}");
            // A run's stdout is the script's own answer, so it goes to the
            // caller's stdout rather than being framed as a diagnostic.
            if !output.is_empty() {
                print!("{output}");
            }
            ExitCode::SUCCESS
        }
        DaemonResponse::Threw { message } => {
            eprintln!("threw: {message}");
            ExitCode::from(1)
        }
        DaemonResponse::Failed { message } => {
            eprintln!("failed: {message}");
            ExitCode::from(1)
        }
        DaemonResponse::TimedOut => {
            eprintln!("terminated: exceeded the deadline");
            ExitCode::from(2)
        }
        DaemonResponse::OutOfMemory => {
            eprintln!("terminated: exceeded the heap limit");
            ExitCode::from(4)
        }
        DaemonResponse::Images { sources } => {
            for (name, source) in &sources {
                println!("{name}\t{source}");
            }
            ExitCode::SUCCESS
        }
        DaemonResponse::Volumes { names } => {
            for name in &names {
                println!("{name}");
            }
            ExitCode::SUCCESS
        }
        DaemonResponse::VolumeFiles { volume, files } => {
            print!("{}", render_volume_tree(&volume, &files));
            ExitCode::SUCCESS
        }
        DaemonResponse::Err { message } => {
            eprintln!("error: {message}");
            ExitCode::from(5)
        }
    }
}

// --- volume tree rendering ---------------------------------------------------

/// One node of a volume's tree: the files directly here and the directories
/// below. `BTreeMap` keeps both alphabetised, so the same map always renders the
/// same way.
#[derive(Default)]
struct VolumeNode {
    files: std::collections::BTreeMap<String, u64>,
    dirs: std::collections::BTreeMap<String, VolumeNode>,
}

impl VolumeNode {
    fn insert(&mut self, path: &str, size: u64) {
        let parts: Vec<&str> =
            path.split('/').filter(|part| !part.is_empty() && *part != ".").collect();
        let Some((name, parents)) = parts.split_last() else { return };
        let mut node = self;
        for dir in parents {
            node = node.dirs.entry((*dir).to_string()).or_default();
        }
        node.files.insert((*name).to_string(), size);
    }

    fn file_count(&self) -> usize {
        self.files.len() + self.dirs.values().map(VolumeNode::file_count).sum::<usize>()
    }

    fn total_bytes(&self) -> u64 {
        self.files.values().copied().sum::<u64>()
            + self.dirs.values().map(VolumeNode::total_bytes).sum::<u64>()
    }
}

/// A tree line before colour: the connectors, the label, and a file's size.
struct TreeLine {
    prefix: String,
    connector: &'static str,
    label: String,
    dir: bool,
    size: Option<u64>,
}

fn collect_lines(node: &VolumeNode, prefix: &str, out: &mut Vec<TreeLine>) {
    let total = node.dirs.len() + node.files.len();
    let mut index = 0usize;
    for (name, child) in &node.dirs {
        index += 1;
        let last = index == total;
        let connector = if last { "└── " } else { "├── " };
        out.push(TreeLine {
            prefix: prefix.to_string(),
            connector,
            label: name.clone(),
            dir: true,
            size: None,
        });
        let next = format!("{prefix}{}", if last { "    " } else { "│   " });
        collect_lines(child, &next, out);
    }
    for (name, size) in &node.files {
        index += 1;
        let last = index == total;
        out.push(TreeLine {
            prefix: prefix.to_string(),
            connector: if last { "└── " } else { "├── " },
            label: name.clone(),
            dir: false,
            size: Some(*size),
        });
    }
}

/// Render a volume's file map as a boxed header plus a tree. Colour is used
/// only when stdout is a terminal, so piping or redirecting stays plain text.
fn render_volume_tree(volume: &str, files: &[(String, u64)]) -> String {
    let color = io::stdout().is_terminal();
    let paint = |text: &str, code: &str| -> String {
        if color { format!("\x1b[{code}m{text}\x1b[0m") } else { text.to_string() }
    };

    let mut root = VolumeNode::default();
    for (path, size) in files {
        root.insert(path, *size);
    }
    let mut lines = Vec::new();
    collect_lines(&root, "", &mut lines);

    let count = root.file_count();
    let summary = format!(
        "{count} {} · {}",
        if count == 1 { "file" } else { "files" },
        human_size(root.total_bytes()),
    );

    let inner = (volume.chars().count() + 2)
        .max(summary.chars().count() + 2)
        .max(24);
    let mut out = String::new();
    out.push_str(&paint("┌", "2"));
    out.push_str(&paint(&format!("─ VOLUME {}", "─".repeat(inner - 9)), "2"));
    out.push_str(&paint("┐", "2"));
    out.push('\n');
    out.push_str(&paint("│", "2"));
    out.push(' ');
    out.push_str(&paint(volume, "1;36"));
    out.push_str(&paint(&format!("{}│", " ".repeat(inner - 1 - volume.chars().count())), "2"));
    out.push('\n');
    out.push_str(&paint(
        &format!("│ {summary}{} │", " ".repeat(inner - 2 - summary.chars().count())),
        "2",
    ));
    out.push('\n');
    out.push_str(&paint(&format!("└{}┘", "─".repeat(inner)), "2"));
    out.push('\n');
    out.push_str(&paint(volume, "1"));
    out.push('\n');

    if lines.is_empty() {
        out.push_str(&paint("└── (empty)\n", "2"));
        return out;
    }

    // Only file labels take part in the size column, so a long directory name
    // does not push every size to the right of a gap it does not need.
    let width = lines
        .iter()
        .filter(|line| line.size.is_some())
        .map(|line| line.label.chars().count())
        .max()
        .unwrap_or(0);
    for line in &lines {
        out.push_str(&paint(&format!("{}{}", line.prefix, line.connector), "2"));
        let label = if line.dir { format!("{}/", line.label) } else { line.label.clone() };
        if line.dir {
            out.push_str(&paint(&label, "1;34"));
        } else {
            out.push_str(&label);
            out.push_str(&" ".repeat(width - label.chars().count() + 2));
            if let Some(size) = line.size {
                out.push_str(&paint(&human_size(size), "2"));
            }
        }
        out.push('\n');
    }
    out
}

fn human_size(bytes: u64) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    if bytes < 1024 {
        return format!("{bytes} B");
    }
    let mut value = bytes as f64;
    let mut unit = 0usize;
    while value >= 1024.0 && unit + 1 < UNITS.len() {
        value /= 1024.0;
        unit += 1;
    }
    if value >= 10.0 {
        format!("{value:.0} {}", UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

fn first_duplicate<'a, I: IntoIterator<Item = &'a String>>(items: I) -> Option<&'a String> {
    let mut seen = std::collections::HashSet::new();
    items.into_iter().find(|item| !seen.insert(item.as_str()))
}

#[cfg(test)]
mod render_tests {
    use super::*;

    #[test]
    fn human_size_switches_at_1024_and_keeps_one_decimal_below_ten() {
        assert_eq!(human_size(0), "0 B");
        assert_eq!(human_size(1023), "1023 B");
        assert_eq!(human_size(1024), "1.0 KB");
        assert_eq!(human_size(1536), "1.5 KB");
        assert_eq!(human_size(10 * 1024), "10 KB");
        assert_eq!(human_size(1024 * 1024), "1.0 MB");
    }

    #[test]
    fn a_volume_renders_as_a_boxed_tree_with_aligned_sizes() {
        let files = vec![
            ("/data/count".to_string(), 1u64),
            ("/data/sub/nested".to_string(), 30),
        ];
        // Tests run without a terminal, so this is the plain-text shape a pipe
        // sees — no escape codes to strip.
        let tree = render_volume_tree("demo", &files);
        assert!(tree.contains("2 files · 31 B"), "{tree}");
        assert!(tree.starts_with("┌─ VOLUME "), "{tree}");

        let data = tree.find("data/").unwrap();
        let sub = tree.find("sub/").unwrap();
        let nested = tree.find("nested").unwrap();
        let count = tree.find("count").unwrap();
        // Directories come first, then files, each alphabetised.
        assert!(data < sub && sub < nested && nested < count, "{tree}");
        // Sizes sit in one column: the labels differ by a space, so the padding
        // does too, and both sizes end up two columns after the longest label.
        assert!(tree.contains("nested  30 B"), "{tree}");
        assert!(tree.contains("count   1 B"), "{tree}");

        let empty = render_volume_tree("hits", &[]);
        assert!(empty.contains("0 files · 0 B"), "{empty}");
        assert!(empty.contains("└── (empty)"), "{empty}");
    }
}
