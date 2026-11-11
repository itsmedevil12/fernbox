//! The published-port service, as a host on the loopback socket sees it.
//!
//! These start the real daemon and worker binaries on a throwaway state
//! directory, grant a run a port, and talk raw HTTP to the gate — so what they
//! check is the whole vertical slice: the daemon binds 127.0.0.1:PORT, buffers
//! and forwards a request, the worker's user realm parses it with the `http`
//! builtin and answers, and the response comes back verbatim. Four behaviours
//! matter:
//!
//! - a granted service answers real HTTP and its volume writes persist;
//! - serving renew the idle budget, so a service in use outlives its initial
//!   deadline;
//! - the hard cap ends a run that is being served continuously, so renewal
//!   cannot keep a service alive forever;
//! - a run with no grant cannot listen at all.

use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

use fernbox_proto::{read_frame, write_frame, ClientRequest, DaemonResponse, Limits, NetFlags, VolumeSpec};

/// The published-port tests race for the one thing `free_port` cannot reserve:
/// the gap between "the OS says this port is free" and "the gate binds it".
/// When two run in parallel they can pick the same number, and the loser's
/// `wait_for_service` then talks to the winner's service — which reads like a
/// cap that did not fire. They take turns instead.
static PORT_TESTS: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// A served daemon, killed when it goes out of scope so a failing test leaves
/// nothing behind but its state directory.
struct Served {
    child: Child,
    state_dir: PathBuf,
}

impl Served {
    fn start(max_runs: usize) -> io::Result<Served> {
        let state_dir = unique_dir("fernbox-test-http");
        std::fs::create_dir_all(&state_dir)?;

        let child = Command::new(env!("CARGO_BIN_EXE_fernbox-daemon"))
            .arg("serve")
            .arg("--state-dir").arg(&state_dir)
            .arg("--max-runs").arg(max_runs.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::inherit())
            .spawn()?;

        let daemon_json = state_dir.join("daemon.json");
        for _ in 0..200 {
            if daemon_json.is_file() {
                return Ok(Served { child, state_dir });
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        Err(io::Error::new(io::ErrorKind::TimedOut, "the daemon never wrote daemon.json"))
    }

    fn endpoint(&self) -> io::Result<(u16, String)> {
        let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(self.daemon_json())?)
            .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;
        let port = json["port"].as_u64()
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "no port in daemon.json"))? as u16;
        let token = json["token"].as_str()
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "no token in daemon.json"))?
            .to_string();
        Ok((port, token))
    }

    fn daemon_json(&self) -> PathBuf {
        self.state_dir.join("daemon.json")
    }
}

impl Drop for Served {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn unique_dir(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("{prefix}-{}-{nanos}", std::process::id()))
}

/// A port the OS says is free right now. The gate binds it moments later; the
/// window is small enough that a collision is not worth a retry loop here.
fn free_port() -> io::Result<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
}

fn connect(port: u16) -> io::Result<TcpStream> {
    let addr = ("127.0.0.1", port).to_socket_addrs()?.next().unwrap();
    let stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))?;
    stream.set_nodelay(true)?;
    Ok(stream)
}

/// Connect, authenticate, and send one request; the reply is the answer. This
/// blocks for the whole run, so a serving run is asked on its own thread.
fn ask(daemon: &Served, token: &str, request: &ClientRequest) -> io::Result<DaemonResponse> {
    let (port, _) = daemon.endpoint()?;
    let mut stream = connect(port)?;
    stream.set_read_timeout(Some(Duration::from_secs(90)))?;
    write_frame(&mut stream, &ClientRequest::Auth { token: token.into() })?;
    write_frame(&mut stream, request)?;
    read_frame(&mut stream)?.ok_or_else(|| io::Error::new(io::ErrorKind::UnexpectedEof, "no reply"))
}

/// One raw HTTP request to the gate, answered with its status and body. The
/// gate frames by Content-Length and closes the connection, so reading to EOF
/// is the whole response.
fn http_request(port: u16, method: &str, path: &str, body: &str) -> io::Result<(u16, String)> {
    let mut stream = connect(port)?;
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: localhost\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(request.as_bytes())?;
    stream.flush()?;
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw)?;
    let text = String::from_utf8_lossy(&raw).into_owned();
    let status = text
        .split("\r\n")
        .next()
        .and_then(|line| line.split(' ').nth(1))
        .and_then(|code| code.parse().ok())
        .unwrap_or(0);
    let body = text.split_once("\r\n\r\n").map(|(_, b)| b.to_string()).unwrap_or_default();
    Ok((status, body))
}

/// Poll the service until it answers 200 on /health. A bound gate is not a
/// listening app: the worker still has to boot and call `listen`, and a request
/// forwarded before then is answered 503. Waiting on a real 200 races neither.
fn wait_for_service(port: u16) -> io::Result<()> {
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        if let Ok((200, _)) = http_request(port, "GET", "/health", "") {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(50));
    }
    Err(io::Error::new(io::ErrorKind::TimedOut, "the service never came up"))
}

fn serve_request(
    app_dir: &Path,
    publish: Option<u16>,
    deadline_ms: u64,
    max_life_ms: Option<u64>,
    volume: Option<&str>,
) -> ClientRequest {
    ClientRequest::Run {
        app_dir: app_dir.to_string_lossy().into_owned(),
        entrypoint: "main.js".into(),
        image: "base".into(),
        volumes: volume
            .into_iter()
            .map(|name| VolumeSpec { name: name.into(), mount: "/data".into() })
            .collect(),
        limits: Limits { deadline_ms, memory_mb: 128, max_life_ms },
        net: NetFlags { allow_loopback: false, allow_private: false, net_timeout: 10 },
        // The app listens on PORT; it has to be the granted port, since the
        // sandbox may listen on exactly that one and no other.
        env: publish.map(|port| vec![format!("PORT={port}")]).unwrap_or_default(),
        args: Vec::new(),
        stdin: String::new(),
        publish,
    }
}

fn http_server_app() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/apps/http_server")
}

#[test]
fn a_published_service_answers_http_and_persists() -> io::Result<()> {
    let _serial = PORT_TESTS.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let daemon = Served::start(4)?;
    let (_, token) = daemon.endpoint()?;
    let port = free_port()?;
    // An idle budget comfortably above the worker's boot time, which the requests
    // below deliberately outlive, and a cap far enough away that idle — not the
    // cap — is what ends the run.
    let request = serve_request(&http_server_app(), Some(port), 1000, Some(15_000), Some("hits"));

    let response = thread::scope(|scope| -> io::Result<DaemonResponse> {
        let run = scope.spawn(|| ask(&daemon, &token, &request).unwrap());
        wait_for_service(port)?;

        // Two hits, spaced so the third lands after the initial idle budget
        // would have expired: a response here is renewal keeping the run alive.
        let (status, body) = http_request(port, "POST", "/hit", "")?;
        assert_eq!(status, 200, "first hit failed: {body}");
        assert_eq!(body, r#"{"count":1}"#);
        thread::sleep(Duration::from_millis(600));

        let (status, body) = http_request(port, "POST", "/hit", "")?;
        assert_eq!(status, 200, "second hit failed: {body}");
        assert_eq!(body, r#"{"count":2}"#);
        thread::sleep(Duration::from_millis(600));

        // Past the initial 1000ms idle now; only renewal explains a live answer.
        let (status, body) = http_request(port, "GET", "/count", "")?;
        assert_eq!(status, 200, "count read failed past the idle budget: {body}");
        assert_eq!(body, r#"{"count":2}"#);

        // The request body crosses the boundary intact and comes back as JSON.
        let (status, body) = http_request(port, "POST", "/echo", "hello sandbox")?;
        assert_eq!(status, 200);
        assert_eq!(body, r#"{"echo":"hello sandbox"}"#);

        // An unknown route is the app's own 404, not the gate's framing error.
        let (status, _) = http_request(port, "GET", "/nope", "")?;
        assert_eq!(status, 404);

        // Stop asking; the idle budget ends the run a short while later.
        Ok(run.join().unwrap())
    })?;

    assert!(matches!(response, DaemonResponse::TimedOut), "the idle service did not end on its deadline: {response:?}");

    // The hits survived the run: a fresh, non-serving run on the same volume
    // reads the count back. This is the persistence the gate exists to enable.
    let read_app = daemon.state_dir.join("readcount");
    std::fs::create_dir_all(&read_app)?;
    std::fs::write(read_app.join("main.js"), "String(fernbox.read(\"/data/count\"))")?;
    let read = serve_request(&read_app, None, 5000, None, Some("hits"));
    let answer = ask(&daemon, &token, &read)?;
    let DaemonResponse::Ok { value, .. } = answer else {
        panic!("the count did not persist: {answer:?}");
    };
    assert_eq!(value, "2", "the volume lost the hits the service wrote");
    Ok(())
}

#[test]
fn the_hard_cap_ends_a_continuously_served_run() -> io::Result<()> {
    let _serial = PORT_TESTS.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let daemon = Served::start(4)?;
    let (_, token) = daemon.endpoint()?;
    let port = free_port()?;
    // The idle budget is above boot time and requests arrive faster than it, so
    // idle never expires while the loop runs: the only thing that can end the run
    // is the hard cap, which renewal cannot push past.
    let request = serve_request(&http_server_app(), Some(port), 2000, Some(3000), None);

    let (response, hits, served) = thread::scope(|scope| -> io::Result<(DaemonResponse, usize, Duration)> {
        let run = scope.spawn(|| ask(&daemon, &token, &request).unwrap());
        wait_for_service(port)?;
        let started = Instant::now();
        let mut hits = 0usize;
        // Keep serving until the gate goes away. A failure here is the cap
        // killing the run mid-loop, which is exactly what is being asserted.
        // The ceiling is well past the cap, so only a missing cap gets here.
        loop {
            match http_request(port, "GET", "/health", "") {
                Ok((200, _)) => hits += 1,
                _ => break,
            }
            if started.elapsed() > Duration::from_secs(10) {
                break;
            }
            thread::sleep(Duration::from_millis(80));
        }
        // How long the gate kept answering — not how long the daemon took to
        // reap the worker afterwards, which is what a loaded machine can stretch.
        let served = started.elapsed();
        Ok((run.join().unwrap(), hits, served))
    })?;

    assert!(matches!(response, DaemonResponse::TimedOut), "a continuously served run did not end on its cap: {response:?}");
    // It served well past the idle budget — renewal worked — and then the cap
    // stopped it. The upper bound is loose for a loaded machine; the point is
    // that continuous activity did not buy indefinite life.
    assert!(hits >= 5, "the run died before it had served past its idle budget: {hits} hits");
    assert!(served < Duration::from_millis(6000), "the cap did not bound a renewing service: {served:?}");
    Ok(())
}

#[test]
fn listen_without_a_grant_fails_the_run() -> io::Result<()> {
    let daemon = Served::start(4)?;
    let (_, token) = daemon.endpoint()?;
    // The app calls `listen`, but the run was granted no port, so the chokepoint
    // refuses and the script throws — listening is a grant, not a capability.
    let request = serve_request(&http_server_app(), None, 5000, None, None);
    let response = ask(&daemon, &token, &request)?;
    let DaemonResponse::Threw { message } = response else {
        panic!("an ungranted listen did not fail the run: {response:?}");
    };
    assert!(message.contains("ERR_PUBLISH"), "the refusal did not name the grant: {message}");
    Ok(())
}