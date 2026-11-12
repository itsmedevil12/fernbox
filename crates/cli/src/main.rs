//! `fernbox`: the thin client.
//!
//! It holds no state and runs no code. Every real thing — the state directory,
//! the network policy, the worker process — lives in the daemon, and the
//! protocol logic is shared with every other caller in `fernbox-client`. This
//! binary only parses arguments, asks the client library, and gives the answer
//! an exit code.
//!
//! The daemon is not started for you. `fernbox run` says so plainly when nothing
//! is listening; starting one is `fernbox-daemon serve`.

use std::io::{self, IsTerminal, Read};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Parser, Subcommand};

mod dev;

use fernbox_client::{state_dir, Endpoint, RunRequest};
use fernbox_proto::{ClientRequest, DaemonResponse};

/// FernBox: run untrusted JavaScript inside a hard-limited sandbox.
#[derive(Parser)]
struct Args {
    /// Use this directory instead of `~/.fernbox` — the same one the daemon was
    /// started with, so the client finds its `daemon.json`.
    #[arg(long, global = true)]
    state_dir: Option<String>,

    /// Connect to this port instead of the one in `daemon.json`.
    #[arg(long, global = true)]
    port: Option<u16>,

    /// Authenticate with this token instead of the one in `daemon.json`.
    #[arg(long, global = true)]
    token: Option<String>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Run an app folder. Its files load as a read-only layer over a base image,
    /// and attached volumes persist their contents across runs.
    Run(AppArgs),
    /// Run an app folder and rebuild whenever it changes. The same run, repeated
    /// on every save: a fresh worker boots each time, so nothing carries over
    /// except volumes.
    Dev(DevArgs),
    /// List the base images the daemon knows about.
    Images(EmptyArgs),
    /// List the named volumes holding persistent state.
    Volumes(EmptyArgs),
    /// Show the files inside a volume as a tree.
    Inspect(InspectArgs),
    /// Freeze a volume into a new base image.
    Commit(CommitArgs),
    /// Build an image from a FernBoxfile.
    Build(BuildArgs),
}

#[derive(Parser)]
struct EmptyArgs {}

#[derive(Parser)]
struct InspectArgs {
    /// The volume to look inside.
    volume: String,
}

#[derive(Parser)]
struct AppArgs {
    /// The app folder to load as a read-only layer over the base image.
    app_dir: PathBuf,
    /// The file inside the app folder to run.
    #[arg(long, default_value = "main.js")]
    entrypoint: String,
    /// Base image to layer the app folder over.
    #[arg(long, default_value = "base")]
    image: String,
    /// Attach a persistent volume, as `NAME:MOUNT`. Repeatable; the mount is the
    /// only subtree that survives the run.
    #[arg(long = "volume", value_name = "NAME:MOUNT")]
    volumes: Vec<String>,
    /// CPU deadline in milliseconds.
    #[arg(long, default_value_t = 5000)]
    deadline_ms: u64,
    /// V8 heap limit in megabytes.
    #[arg(long, default_value_t = 128)]
    memory_mb: usize,
    /// Grant this loopback port for the run to serve on. The daemon binds
    /// 127.0.0.1:PORT and forwards what arrives, so the service is curl-able
    /// from this machine; without it, `http.listen` is refused. Open on loopback
    /// — the grant is the allowlist.
    #[arg(long, value_name = "PORT")]
    publish: Option<u16>,
    /// Stream the script's output as it is written, instead of printing it all
    /// once the run ends. The daemon relays each chunk to its own stderr, so a
    /// long run shows progress instead of a blank terminal.
    #[arg(long, default_value_t = false)]
    stream: bool,
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
struct DevArgs {
    /// The app folder to watch and run.
    app_dir: PathBuf,
    /// The file inside the app folder to run.
    #[arg(long, default_value = "main.js")]
    entrypoint: String,
    /// Base image to layer the app folder over.
    #[arg(long, default_value = "base")]
    image: String,
    /// Attach a persistent volume, as `NAME:MOUNT`. Repeatable. Volumes survive
    /// a rebuild, so state written by one run is there for the next.
    #[arg(long = "volume", value_name = "NAME:MOUNT")]
    volumes: Vec<String>,
    /// CPU deadline in milliseconds for each run.
    #[arg(long, default_value_t = 5000)]
    deadline_ms: u64,
    /// V8 heap limit in megabytes.
    #[arg(long, default_value_t = 128)]
    memory_mb: usize,
    /// Grant this loopback port so the run can serve. Output is always streamed
    /// under `dev`, so request traffic shows up in the daemon's log as it
    /// arrives.
    #[arg(long, value_name = "PORT")]
    publish: Option<u16>,
    /// Hard lifetime cap in milliseconds for a serving run.
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
    /// Set an environment variable, as `KEY=VALUE`. Repeatable.
    #[arg(long = "env", value_name = "KEY=VALUE")]
    env: Vec<String>,
    /// Arguments after the entrypoint. `process.argv` sees them at index 2.
    #[arg(last = true)]
    args: Vec<String>,
}

#[derive(Parser)]
struct BuildArgs {
    /// The FernBoxfile to build. Its folder is the build context, and every
    /// `COPY` source is resolved against it.
    #[arg(long, short = 'f', default_value = "FernBoxfile")]
    file: PathBuf,
    /// The image name to write. Defaults to the base image's name plus the
    /// context folder's name, so a build is never unnamed.
    #[arg(long, short = 't')]
    tag: Option<String>,
}

#[derive(Parser)]
struct CommitArgs {
    /// The volume to freeze.
    volume: String,
    /// The image name to write it under.
    image: String,
    /// The base image the frozen state is layered over.
    #[arg(long, default_value = "base")]
    from: String,
}

fn main() -> ExitCode {
    let args = Args::parse();

    // `dev` is a loop, not a request, so it gets its own path out of here before
    // the one-shot plumbing below assumes there is exactly one reply.
    if let Command::Dev(dev) = &args.command {
        return dev_command(&args, dev);
    }

    // A bad argument never reaches the daemon, so it is reported before a
    // connection is attempted — no "daemon unreachable" for a missing folder.
    let request = match request_for(&args.command) {
        Ok(request) => request,
        Err(msg) => {
            eprintln!("error: {msg}");
            return ExitCode::from(3);
        }
    };

    let state_dir = match state_dir(args.state_dir.as_deref()) {
        Ok(dir) => dir,
        Err(msg) => {
            eprintln!("error: {msg}");
            return ExitCode::from(5);
        }
    };

    let endpoint = match Endpoint::resolve(&state_dir, args.port, args.token) {
        Ok(endpoint) => endpoint,
        Err(msg) => {
            // This is the one error a user hits on a cold machine, so it names
            // the fix instead of just the symptom.
            eprintln!("error: {msg}");
            eprintln!("start one with `fernbox-daemon serve`");
            return ExitCode::from(7);
        }
    };

    match fernbox_client::request(&endpoint, &request) {
        Ok(response) => print_response(response),
        Err(msg) => {
            eprintln!("error: {msg}");
            eprintln!("start one with `fernbox-daemon serve`");
            ExitCode::from(7)
        }
    }
}

/// Turn the subcommand into a request, validating the `Run` arguments on the
/// way: a relative or unreadable app folder is a local mistake, not a daemon
/// error.
fn request_for(command: &Command) -> Result<ClientRequest, String> {
    match command {
        // Handled above, before the one-shot plumbing assumed a single reply.
        Command::Dev(_) => unreachable!("dev is dispatched before request_for"),
        Command::Run(app) => {
            // What was piped in is the app's stdin, read in full before the run
            // starts — the sandbox has no way to receive it live, so this is the
            // whole of what `process.stdin` will see. A terminal is left alone:
            // reading one would block on a caller who may never be done typing,
            // and an unread stdin is an empty one.
            let stdin = if io::stdin().is_terminal() {
                String::new()
            } else {
                let mut buf = String::new();
                io::stdin()
                    .read_to_string(&mut buf)
                    .map_err(|err| format!("cannot read stdin: {err}"))?;
                buf
            };
            Ok(RunRequest::new(
                app.app_dir.clone(),
                app.entrypoint.clone(),
                app.image.clone(),
                app.volumes.clone(),
                app.deadline_ms,
                app.memory_mb,
                app.allow_loopback,
                app.allow_private,
                app.net_timeout,
                app.env.clone(),
                app.args.clone(),
                stdin,
                app.publish,
                app.stream,
                app.max_life_ms,
            )?
            .to_request())
        }
        Command::Images(_) => Ok(ClientRequest::Images),
        Command::Volumes(_) => Ok(ClientRequest::Volumes),
        Command::Inspect(inspect) => {
            Ok(ClientRequest::VolumeFiles { volume: inspect.volume.clone() })
        }
        Command::Build(build) => {
            let text = std::fs::read_to_string(&build.file).map_err(|err| {
                format!("cannot read {}: {err}", build.file.display())
            })?;
            let context = std::fs::canonicalize(
                build.file.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new(".")),
            )
            .map_err(|err| format!("cannot read the build context: {err}"))?;
            Ok(ClientRequest::Build {
                file: text,
                context: context.to_string_lossy().into_owned(),
                tag: build.tag.clone(),
            })
        }
        Command::Commit(commit) => Ok(ClientRequest::Commit {
            volume: commit.volume.clone(),
            image: commit.image.clone(),
            from: commit.from.clone(),
        }),
    }
}

/// Print a response and give it the exit code it means.
fn print_response(response: DaemonResponse) -> ExitCode {
    match response {
        DaemonResponse::Ok { value, output } => {
            println!("completed: {value}");
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

/// `fernbox dev`: build once, then rebuild on every save.
///
/// The first build is a plain run, so a broken app is reported before a watcher
/// is started. After that the loop belongs to [`dev::watch`]: it waits for the
/// folder to settle, says what changed, and runs again. A rebuild's exit code is
/// printed but never ends the session — a failing build is the normal reason to
/// keep watching.
fn dev_command(args: &Args, dev: &DevArgs) -> ExitCode {
    let state = match state_dir(args.state_dir.as_deref()) {
        Ok(dir) => dir,
        Err(msg) => {
            eprintln!("error: {msg}");
            return ExitCode::from(5);
        }
    };
    let endpoint = match Endpoint::resolve(&state, args.port, args.token.clone()) {
        Ok(endpoint) => endpoint,
        Err(msg) => {
            eprintln!("error: {msg}");
            eprintln!("start one with `fernbox-daemon serve`");
            return ExitCode::from(7);
        }
    };

    let app_dir = match std::fs::canonicalize(&dev.app_dir) {
        Ok(dir) => dir,
        Err(err) => {
            eprintln!("error: app folder {} cannot be read: {err}", dev.app_dir.display());
            return ExitCode::from(3);
        }
    };

    // The request is built once and reused: every rebuild is the same run, so a
    // rebuild cannot quietly differ from the first build.
    let request = match dev_request(dev, &app_dir) {
        Ok(request) => request,
        Err(msg) => {
            eprintln!("error: {msg}");
            return ExitCode::from(3);
        }
    };

    eprintln!("watching {}  (ctrl-c to stop)", app_dir.display());

    let mut build = 0u32;
    let mut first: Option<ExitCode> = None;
    loop {
        build += 1;
        eprintln!();
        eprintln!("── build {build} ──");
        match dev::run_once(&endpoint, &request) {
            Ok(code) => {
                if first.is_none() {
                    first = Some(code);
                }
            }
            Err(msg) => {
                // A lost daemon is not something an edit can fix; say so and
                // stop rather than rebuilding into the same error forever.
                eprintln!("error: {msg}");
                return ExitCode::from(7);
            }
        }

        // The watcher owns the loop from here: it blocks until a change settles,
        // reports it, and the closure runs the next build.
        dev::watch(&app_dir, |change| {
            build += 1;
            eprintln!();
            eprintln!("changed: {} — starting build {build}", change.summary());
            match dev::run_once(&endpoint, &request) {
                Ok(_) => {}
                Err(msg) => eprintln!("error: {msg}"),
            }
        });

        // `watch` only returns if its loop is broken out of; there is no such
        // path today, but returning the first build's code is the honest answer
        // if one is ever added.
        if let Some(code) = first {
            return code;
        }
    }
}

/// Build the `Run` request `dev` repeats. Volume specs are parsed here rather
/// than in the daemon so a typo is reported before the watcher starts.
fn dev_request(dev: &DevArgs, app_dir: &std::path::Path) -> Result<ClientRequest, String> {
    Ok(RunRequest::new(
        app_dir.to_path_buf(),
        dev.entrypoint.clone(),
        dev.image.clone(),
        dev.volumes.clone(),
        dev.deadline_ms,
        dev.memory_mb,
        dev.allow_loopback,
        dev.allow_private,
        dev.net_timeout,
        dev.env.clone(),
        dev.args.clone(),
        String::new(),
        dev.publish,
        true,
        dev.max_life_ms,
    )?
    .to_request())
}
