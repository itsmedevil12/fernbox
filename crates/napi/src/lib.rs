//! The JavaScript binding: the same client the CLI has, from Node.
//!
//! Nothing here is a second implementation. [`fernbox_client`] holds the one
//! protocol, and this crate only translates between its Rust types and JS
//! values — arguments in, results out. A run from a shell and a run from Node
//! find the same daemon and see the same answers.
//!
//! The shape of the API follows from what the sandbox is for. A run's outcome is
//! delivered as a resolved value rather than a thrown error: a script that
//! throws, times out, or exhausts its heap has done exactly what it was asked
//! to do, and that is *data* about untrusted code, not a failure of the call.
//! Only the things the caller owns — a bad argument, an unreachable daemon, a
//! request the daemon itself refused — reject. Conflating the two would make
//! `catch` mean both "the sandbox misbehaved" and "I asked wrongly", and a
//! caller could not tell which.
//!
//! Every function is asynchronous and its work runs on libuv's threadpool, not
//! the main thread: a run may take as long as its deadline, and blocking the
//! event loop for that long would stall the process that asked for the run.

#[macro_use]
extern crate napi_derive;

use napi::bindgen_prelude::*;
use napi::Task;

use fernbox_client::{state_dir, Endpoint, RunRequest};
use fernbox_proto::{ClientRequest, DaemonResponse};

/// How to find the daemon. All optional: the defaults come from `daemon.json`,
/// which the daemon wrote when it started.
#[napi(object)]
pub struct DaemonOptions {
  /// Use this directory instead of `~/.fernbox` — the same one the daemon was
  /// started with.
  pub state_dir: Option<String>,
  /// Connect to this port instead of the one in `daemon.json`.
  pub port: Option<u16>,
  /// Authenticate with this token instead of the one in `daemon.json`.
  pub token: Option<String>,
}

/// A run's arguments. Only `appDir` is required; the rest fall back to the same
/// defaults the CLI uses.
#[napi(object)]
pub struct RunOptions {
  /// Absolute path to the app folder. The daemon reads it from its own disk, so
  /// a relative path is meaningless over there and is rejected.
  pub app_dir: String,
  /// The file inside the app folder to run.
  pub entrypoint: Option<String>,
  /// Base image to layer the app folder over.
  pub image: Option<String>,
  /// Attach persistent volumes as `NAME:MOUNT`. The mount is the only subtree
  /// whose contents survive the run.
  pub volumes: Option<Vec<String>>,
  /// CPU deadline in milliseconds.
  pub deadline_ms: Option<u32>,
  /// V8 heap limit in megabytes.
  pub memory_mb: Option<u32>,
  /// Allow the sandbox to connect to loopback addresses.
  pub allow_loopback: Option<bool>,
  /// Allow the sandbox to connect to private (RFC 1918) addresses.
  pub allow_private: Option<bool>,
  /// Per-fetch timeout in seconds, covering every redirect hop.
  pub net_timeout: Option<u32>,
  /// `KEY=VALUE` entries for `process.env`. The sandbox never sees the host's
  /// environment, only these.
  pub env: Option<Vec<String>>,
  /// Arguments after the entrypoint; `process.argv` sees them at index 2.
  pub args: Option<Vec<String>>,
  /// The text the app sees on `process.stdin`. The whole of it is read before
  /// the run starts; nothing typed live reaches the sandbox.
  pub stdin: Option<String>,
  /// Grant this loopback port for the run to serve on. The daemon binds
  /// 127.0.0.1:PORT and forwards what arrives; without it, listening is refused.
  pub publish: Option<u16>,
  /// Hard lifetime cap in milliseconds for a serving run. Defaults to one hour
  /// when a port is published; ignored otherwise.
  pub max_life_ms: Option<u32>,
  /// How to find the daemon, if not `~/.fernbox`.
  pub state_dir: Option<String>,
  pub port: Option<u16>,
  pub token: Option<String>,
}

/// What a run came to. `outcome` discriminates the four ways a sandboxed script
/// can finish; `value` is set only for `completed`, `message` only for `threw`
/// and `failed`. `output` holds everything the script wrote to its stdout.
#[napi(object)]
pub struct RunResult {
  pub outcome: String,
  pub value: Option<String>,
  pub message: Option<String>,
  pub output: Option<String>,
}

/// One entry from `images`.
#[napi(object)]
pub struct ImageEntry {
  pub name: String,
  /// Where the image lives: `bundled`, or `disk` for one made by `commit`.
  pub source: String,
}

// --- the work, off the main thread -----------------------------------------

/// A run, as a threadpool task.
pub struct RunTask(RunOptions);

impl Task for RunTask {
  type Output = RunResult;
  type JsValue = RunResult;

  fn compute(&mut self) -> Result<Self::Output> {
    let opts = &self.0;
    let request = run_request(opts)?;
    let endpoint = endpoint_for(opts.state_dir.as_deref(), opts.port, opts.token.as_deref())?;
    let response = fernbox_client::request(&endpoint, &request).map_err(daemon_unreachable)?;
    // A run's response is the outcome; the daemon refusing the request is not.
    match response {
      DaemonResponse::Ok { value, output } => Ok(RunResult {
        outcome: "completed".into(),
        value: Some(value),
        message: None,
        output: Some(output),
      }),
      DaemonResponse::Threw { message } => Ok(RunResult {
        outcome: "threw".into(),
        value: None,
        message: Some(message),
        output: None,
      }),
      DaemonResponse::Failed { message } => Ok(RunResult {
        outcome: "failed".into(),
        value: None,
        message: Some(message),
        output: None,
      }),
      DaemonResponse::TimedOut => Ok(RunResult {
        outcome: "timedOut".into(),
        value: None,
        message: None,
        output: None,
      }),
      DaemonResponse::OutOfMemory => Ok(RunResult {
        outcome: "outOfMemory".into(),
        value: None,
        message: None,
        output: None,
      }),
      DaemonResponse::Err { message } => {
        Err(Error::new(Status::GenericFailure, format!("the daemon refused the run: {message}")))
      }
      // A run request cannot come back as a listing; the peer is broken.
      DaemonResponse::Images { .. }
      | DaemonResponse::Volumes { .. }
      | DaemonResponse::VolumeFiles { .. } => Err(Error::new(
        Status::GenericFailure,
        "the daemon answered a run with a listing".to_string(),
      )),
    }
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

/// `images`, as a threadpool task.
pub struct ImagesTask(DaemonOptions);

impl Task for ImagesTask {
  type Output = Vec<ImageEntry>;
  type JsValue = Vec<ImageEntry>;

  fn compute(&mut self) -> Result<Self::Output> {
    let opts = &self.0;
    let endpoint = endpoint_for(opts.state_dir.as_deref(), opts.port, opts.token.as_deref())?;
    match fernbox_client::request(&endpoint, &ClientRequest::Images).map_err(daemon_unreachable)? {
      DaemonResponse::Images { sources } => Ok(sources
        .into_iter()
        .map(|(name, source)| ImageEntry { name, source })
        .collect()),
      DaemonResponse::Err { message } => {
        Err(Error::new(Status::GenericFailure, format!("the daemon refused the request: {message}")))
      }
      other => Err(Error::new(
        Status::GenericFailure,
        format!("the daemon answered {other:?} to an images request"),
      )),
    }
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

/// `volumes`, as a threadpool task.
pub struct VolumesTask(DaemonOptions);

impl Task for VolumesTask {
  type Output = Vec<String>;
  type JsValue = Vec<String>;

  fn compute(&mut self) -> Result<Self::Output> {
    let opts = &self.0;
    let endpoint = endpoint_for(opts.state_dir.as_deref(), opts.port, opts.token.as_deref())?;
    match fernbox_client::request(&endpoint, &ClientRequest::Volumes).map_err(daemon_unreachable)? {
      DaemonResponse::Volumes { names } => Ok(names),
      DaemonResponse::Err { message } => {
        Err(Error::new(Status::GenericFailure, format!("the daemon refused the request: {message}")))
      }
      other => Err(Error::new(
        Status::GenericFailure,
        format!("the daemon answered {other:?} to a volumes request"),
      )),
    }
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

/// `commit`, as a threadpool task.
pub struct CommitTask {
  volume: String,
  image: String,
  from: String,
  daemon: DaemonOptions,
}

impl Task for CommitTask {
  type Output = String;
  type JsValue = String;

  fn compute(&mut self) -> Result<Self::Output> {
    let endpoint = endpoint_for(
      self.daemon.state_dir.as_deref(),
      self.daemon.port,
      self.daemon.token.as_deref(),
    )?;
    let request = ClientRequest::Commit {
      volume: self.volume.clone(),
      image: self.image.clone(),
      from: self.from.clone(),
    };
    match fernbox_client::request(&endpoint, &request).map_err(daemon_unreachable)? {
      DaemonResponse::Ok { value, .. } => Ok(value),
      DaemonResponse::Err { message } => {
        Err(Error::new(Status::GenericFailure, format!("the daemon refused the commit: {message}")))
      }
      other => Err(Error::new(
        Status::GenericFailure,
        format!("the daemon answered {other:?} to a commit request"),
      )),
    }
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

/// A failure to reach or understand the daemon is the caller's problem to fix,
/// so it keeps the reason and the remedy.
fn daemon_unreachable(msg: String) -> Error {
  Error::new(Status::GenericFailure, format!("{msg}; start one with `fernbox-daemon serve`"))
}

// --- the JS surface --------------------------------------------------------

/// Run an app folder. Resolves with a [`RunResult`]; rejects only for a bad
/// argument, an unreachable daemon, or a request the daemon itself refused.
#[napi(ts_return_type = "Promise<RunResult>")]
pub fn run(opts: RunOptions) -> AsyncTask<RunTask> {
  AsyncTask::new(RunTask(opts))
}

/// List the base images the daemon knows about.
#[napi(ts_return_type = "Promise<Array<ImageEntry>>")]
pub fn images(opts: DaemonOptions) -> AsyncTask<ImagesTask> {
  AsyncTask::new(ImagesTask(opts))
}

/// List the named volumes holding persistent state.
#[napi(ts_return_type = "Promise<Array<string>>")]
pub fn volumes(opts: DaemonOptions) -> AsyncTask<VolumesTask> {
  AsyncTask::new(VolumesTask(opts))
}

/// Freeze a volume into a new base image, layered over `from`.
#[napi(ts_return_type = "Promise<string>")]
pub fn commit(
  volume: String,
  image: String,
  from: String,
  opts: DaemonOptions,
) -> AsyncTask<CommitTask> {
  AsyncTask::new(CommitTask { volume, image, from, daemon: opts })
}

/// Turn `RunOptions` into the wire request, applying the CLI's defaults.
fn run_request(opts: &RunOptions) -> Result<ClientRequest> {
  let volumes = opts.volumes.clone().unwrap_or_default();
  Ok(RunRequest::new(
    opts.app_dir.clone().into(),
    opts.entrypoint.clone().unwrap_or_else(|| "main.js".into()),
    opts.image.clone().unwrap_or_else(|| "base".into()),
    volumes,
    opts.deadline_ms.unwrap_or(5000) as u64,
    opts.memory_mb.unwrap_or(128) as usize,
    opts.allow_loopback.unwrap_or(false),
    opts.allow_private.unwrap_or(false),
    opts.net_timeout.unwrap_or(10) as u64,
    opts.env.clone().unwrap_or_default(),
    opts.args.clone().unwrap_or_default(),
    opts.stdin.clone().unwrap_or_default(),
    opts.publish,
    opts.max_life_ms.map(|ms| ms as u64),
  )
  .map_err(|msg| Error::new(Status::InvalidArg, msg))?
  .to_request())
}

/// Resolve the endpoint, saying where the daemon is rather than just that it is
/// not there.
fn endpoint_for(
  dir_override: Option<&str>,
  port: Option<u16>,
  token: Option<&str>,
) -> Result<Endpoint> {
  let dir = state_dir(dir_override).map_err(|msg| Error::new(Status::InvalidArg, msg))?;
  Endpoint::resolve(&dir, port, token.map(str::to_string)).map_err(|msg| {
    Error::new(Status::GenericFailure, format!("{msg}; start one with `fernbox-daemon serve`"))
  })
}
