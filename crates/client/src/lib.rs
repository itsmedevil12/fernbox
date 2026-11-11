//! The client half of the daemon's protocol, shared by every caller.
//!
//! Two surfaces need it today — the `fernbox` CLI and the napi package — and
//! they must not drift apart: a run from a shell and a run from Node find the
//! same daemon, authenticate the same way, and see the same answers. So this is
//! the one implementation of "talk to the daemon", and both are thin over it.
//!
//! Like the CLI, the library holds no state and runs no code. It reads
//! `daemon.json` to find the daemon, authenticates with the token it finds
//! there, sends one request, and hands back the response. Everything real — the
//! state directory, the network policy, the worker process — lives in the
//! daemon, which is the point of the split.
//!
//! The daemon is not started for you. [`request`] says so plainly when nothing
//! is listening; starting one is `fernbox-daemon serve`.

use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::Duration;

use fernbox_proto::{
    read_frame, write_frame, ClientRequest, DaemonResponse, Limits, NetFlags, VolumeSpec,
};

/// Where the client looks for the daemon's address and token.
const DAEMON_JSON: &str = "daemon.json";
/// How long to wait for the daemon to accept a connection. A daemon that is
/// there answers immediately; one that is not should not hang the caller.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);

/// Where the daemon is, and how to prove this client may talk to it.
pub struct Endpoint {
    pub port: u16,
    pub token: String,
}

impl Endpoint {
    /// Find the daemon. An explicit `--port`/`--token` pair wins outright;
    /// otherwise both come from `daemon.json`, which the daemon wrote when it
    /// started.
    pub fn resolve(
        state_dir: &Path,
        port: Option<u16>,
        token: Option<String>,
    ) -> Result<Endpoint, String> {
        let file = state_dir.join(DAEMON_JSON);
        let json = std::fs::read_to_string(&file)
            .map_err(|err| format!("cannot read {}: {err}", file.display()))?;
        let parsed: serde_json::Value = serde_json::from_str(&json)
            .map_err(|err| format!("{} is not the daemon's address file: {err}", file.display()))?;

        let port = match port {
            Some(port) => port,
            None => parsed
                .get("port")
                .and_then(|p| p.as_u64())
                .ok_or_else(|| format!("{} has no port", file.display()))? as u16,
        };
        let token = match token {
            Some(token) => token,
            None => parsed
                .get("token")
                .and_then(|t| t.as_str())
                .ok_or_else(|| format!("{} has no token", file.display()))?
                .to_string(),
        };
        Ok(Endpoint { port, token })
    }

    /// Connect and authenticate, or say why the daemon is unreachable. The token
    /// goes first, unconditionally, and a mismatch closes the connection without
    /// a word — so a failure here means the wrong daemon or the wrong state
    /// directory, not a daemon that refused the request.
    fn connect(&self) -> Result<TcpStream, String> {
        let address = format!("127.0.0.1:{}", self.port);
        let stream = TcpStream::connect_timeout(
            &address
                .parse()
                .map_err(|err| format!("the daemon's address {address} is invalid: {err}"))?,
            CONNECT_TIMEOUT,
        )
        .map_err(|err| format!("cannot reach the daemon at {address}: {err}"))?;
        stream
            .set_nodelay(true)
            .map_err(|err| format!("cannot set up the daemon connection: {err}"))?;
        Ok(stream)
    }
}

/// One request and one response. Nothing is retried and nothing is pipelined:
/// a run is a single conversation, and the daemon answers it or the connection
/// is dropped.
pub fn request(endpoint: &Endpoint, request: &ClientRequest) -> Result<DaemonResponse, String> {
    let mut stream = endpoint.connect()?;
    write_frame(&mut stream, &ClientRequest::Auth { token: endpoint.token.clone() })
        .map_err(|err| format!("cannot send the token: {err}"))?;
    write_frame(&mut stream, request).map_err(|err| format!("cannot send the request: {err}"))?;
    match read_frame::<_, DaemonResponse>(&mut stream) {
        Ok(Some(response)) => Ok(response),
        Ok(None) => Err("the daemon closed the connection without answering".into()),
        Err(err) => Err(format!("the daemon's answer was unreadable: {err}")),
    }
}

/// `~/.fernbox` unless something overrides it. `home` finds it without touching
/// the ambient environment, so a process cannot point a client elsewhere by
/// exporting a variable — the state directory is a fact about the machine, not
/// a setting a script may choose.
pub fn state_dir(override_dir: Option<&str>) -> Result<PathBuf, String> {
    match override_dir {
        Some(dir) => Ok(PathBuf::from(dir)),
        None => Ok(home::home_dir()
            .ok_or("cannot locate the user's home directory")?
            .join(".fernbox")),
    }
}

/// A `Run` request, with the arguments the wire type cannot check for itself
/// validated up front: the app folder must be absolute and readable, because
/// the daemon reads it off its own disk and a relative path means nothing over
/// there, and every volume must be `NAME:MOUNT` with neither half empty.
pub struct RunRequest {
    app_dir: String,
    entrypoint: String,
    image: String,
    volumes: Vec<VolumeSpec>,
    limits: Limits,
    net: NetFlags,
    env: Vec<String>,
    args: Vec<String>,
    stdin: String,
    publish: Option<u16>,
}

impl RunRequest {
    pub fn new(
        app_dir: PathBuf,
        entrypoint: String,
        image: String,
        volumes: Vec<String>,
        deadline_ms: u64,
        memory_mb: usize,
        allow_loopback: bool,
        allow_private: bool,
        net_timeout: u64,
        env: Vec<String>,
        args: Vec<String>,
        stdin: String,
        publish: Option<u16>,
        max_life_ms: Option<u64>,
    ) -> Result<RunRequest, String> {
        let app_dir = std::fs::canonicalize(&app_dir)
            .map_err(|err| format!("app folder {} cannot be read: {err}", app_dir.display()))?;
        let app_dir = app_dir.to_str().map(str::to_string).ok_or_else(|| {
            format!("app folder {} is not valid utf8", app_dir.display())
        })?;

        let mut parsed = Vec::with_capacity(volumes.len());
        for spec in &volumes {
            let Some((name, mount)) = spec.split_once(':') else {
                return Err(format!("volume `{spec}` must be NAME:MOUNT"));
            };
            if name.is_empty() || mount.is_empty() {
                return Err(format!("volume `{spec}` must be NAME:MOUNT"));
            }
            parsed.push(VolumeSpec { name: name.into(), mount: mount.into() });
        }

        // A pair with no key carries no value and a pair with no separator is
        // not a pair at all. Either is a bad request rather than a silently
        // dropped environment entry.
        for pair in &env {
            let Some((key, _)) = pair.split_once('=') else {
                return Err(format!("env `{pair}` must be KEY=VALUE"));
            };
            if key.is_empty() {
                return Err(format!("env `{pair}` has no key"));
            }
        }

        // Port 0 is the OS's "pick one" sentinel, not a port a service can be
        // reached on; a grant has to name a real one. The upper bound is the
        // type's own — a u16 cannot exceed 65535.
        if publish == Some(0) {
            return Err("publish port must be between 1 and 65535".into());
        }

        Ok(RunRequest {
            app_dir,
            entrypoint,
            image,
            volumes: parsed,
            limits: Limits { deadline_ms, memory_mb, max_life_ms },
            net: NetFlags { allow_loopback, allow_private, net_timeout },
            env,
            args,
            stdin,
            publish,
        })
    }

    /// The wire type. Callers that already hold a `ClientRequest` — listing
    /// images, say — use [`request`] directly; this is the one request with
    /// arguments worth validating.
    pub fn to_request(&self) -> ClientRequest {
        ClientRequest::Run {
            app_dir: self.app_dir.clone(),
            entrypoint: self.entrypoint.clone(),
            image: self.image.clone(),
            volumes: self.volumes.clone(),
            limits: self.limits.clone(),
            net: self.net.clone(),
            env: self.env.clone(),
            args: self.args.clone(),
            stdin: self.stdin.clone(),
            publish: self.publish,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A folder the tests may canonicalise, so the requests validate.
    fn app_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/apps/argv_env")
    }

    /// Build a request with only the pieces these tests exercise, the rest at
    /// the CLI's defaults.
    fn build(volumes: Vec<String>, env: Vec<String>, stdin: String) -> Result<ClientRequest, String> {
        RunRequest::new(
            app_dir(),
            "main.js".into(),
            "base".into(),
            volumes,
            5000,
            128,
            false,
            false,
            10,
            env,
            vec![],
            stdin,
            None,
            None,
        )
        .map(|request| request.to_request())
    }

    /// What the caller piped in has to survive onto the wire, because the wire
    /// is the only place the daemon learns of it — and an unpiped run has to
    /// carry an empty one, so a `None` on the receiving end could not mean both.
    #[test]
    fn piped_stdin_reaches_the_wire() {
        let ClientRequest::Run { stdin, .. } = build(vec![], vec![], "piped text\n".into()).unwrap() else {
            panic!("the request decoded as something other than a run");
        };
        assert_eq!(stdin, "piped text\n");

        let ClientRequest::Run { stdin, .. } = build(vec![], vec![], String::new()).unwrap() else {
            panic!("the request decoded as something other than a run");
        };
        assert_eq!(stdin, "");
    }

    #[test]
    fn a_volume_without_a_mount_is_refused() {
        assert!(build(vec!["data".into()], vec![], String::new()).is_err());
        assert!(build(vec!["data:".into()], vec![], String::new()).is_err());
        assert!(build(vec![":/data".into()], vec![], String::new()).is_err());
        assert!(build(vec!["data:/data".into()], vec![], String::new()).is_ok());
    }

    #[test]
    fn an_env_pair_without_a_key_is_refused() {
        assert!(build(vec![], vec!["=value".into()], String::new()).is_err());
        assert!(build(vec![], vec!["no separator".into()], String::new()).is_err());
        assert!(build(vec![], vec!["KEY=value".into()], String::new()).is_ok());
    }

    #[test]
    fn a_publish_grant_and_cap_reach_the_wire() {
        let request = RunRequest::new(
            app_dir(),
            "main.js".into(),
            "base".into(),
            vec![],
            5000,
            128,
            false,
            false,
            10,
            vec![],
            vec![],
            String::new(),
            Some(8080),
            Some(60_000),
        )
        .unwrap()
        .to_request();
        let ClientRequest::Run { publish, limits, .. } = request else {
            panic!("the request decoded as something other than a run");
        };
        assert_eq!(publish, Some(8080));
        assert_eq!(limits.max_life_ms, Some(60_000));
    }

    #[test]
    fn publish_port_zero_is_refused() {
        let result = RunRequest::new(
            app_dir(),
            "main.js".into(),
            "base".into(),
            vec![],
            5000,
            128,
            false,
            false,
            10,
            vec![],
            vec![],
            String::new(),
            Some(0),
            None,
        );
        assert!(result.is_err());
    }
}
