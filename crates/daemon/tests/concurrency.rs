//! The daemon's concurrency, as a client on a socket sees it.
//!
//! These start the real binary on a throwaway state directory and talk the wire
//! protocol, so what they check is not the locking in isolation but the whole
//! path: the accept loop, the frame reader, the permit, and `handle` underneath.
//! Three behaviours matter:
//!
//! - a wrong token gets nothing back at all, because answering would turn a
//!   failed guess into an oracle;
//! - with one slot, overlapping runs on one volume still take turns, so a count
//!   comes out of each one rather than several runs reading the same prior
//!   value and writing the same next one;
//! - with four slots, four runs of the same length finish in the time of one,
//!   because the slots are real parallelism and not a queue that happens to
//!   admit four.

use std::io::{self, Read};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

use fernbox_proto::{read_frame, write_frame, ClientRequest, DaemonResponse, Limits, NetFlags, VolumeSpec};

/// How long a run is asked to spin before its deadline stops it. Long enough to
/// be measured, short enough that a serialised group of four is unmistakable.
const SPIN_MS: u64 = 1500;

/// A served daemon, killed when it goes out of scope so a failing test leaves
/// nothing behind but its state directory.
struct Served {
    child: Child,
    state_dir: PathBuf,
}

impl Served {
    fn start(max_runs: usize) -> io::Result<Served> {
        let state_dir = unique_dir("fernbox-test-concurrency");
        std::fs::create_dir_all(&state_dir)?;

        let child = Command::new(env!("CARGO_BIN_EXE_fernbox-daemon"))
            .arg("serve")
            .arg("--state-dir").arg(&state_dir)
            .arg("--max-runs").arg(max_runs.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::inherit())
            .spawn()?;

        let daemon_json = state_dir.join("daemon.json");
        // The daemon writes `daemon.json` before it accepts anything, so its
        // appearance is the signal that the socket is listening. Without
        // waiting, a client's connect would race the bind.
        for _ in 0..200 {
            if daemon_json.is_file() {
                return Ok(Served { child, state_dir });
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        Err(io::Error::new(io::ErrorKind::TimedOut, "the daemon never wrote daemon.json"))
    }

    /// The port and token the daemon published, from the file the client reads.
    fn endpoint(&self) -> io::Result<(u16, String)> {
        let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(self.daemon_json())?)
            .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;
        let port = json["port"]
            .as_u64()
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "no port in daemon.json"))? as u16;
        let token = json["token"]
            .as_str()
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

/// A directory under the temp directory that nothing else is using.
fn unique_dir(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("{prefix}-{}-{nanos}", std::process::id()))
}

/// A connected socket with a read deadline, so a daemon that never answers
/// fails this test instead of hanging it.
fn connect(port: u16) -> io::Result<TcpStream> {
    let addr = ("127.0.0.1", port).to_socket_addrs()?.next().unwrap();
    let stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))?;
    stream.set_read_timeout(Some(Duration::from_secs(90)))?;
    Ok(stream)
}

/// Connect, authenticate, and send one request; the reply is the answer.
fn ask(daemon: &Served, token: &str, request: &ClientRequest) -> io::Result<DaemonResponse> {
    let (port, _) = daemon.endpoint()?;
    let mut stream = connect(port)?;
    write_frame(&mut stream, &ClientRequest::Auth { token: token.into() })?;
    write_frame(&mut stream, request)?;
    read_frame(&mut stream)?.ok_or_else(|| io::Error::new(io::ErrorKind::UnexpectedEof, "no reply"))
}

/// A run request for `app_dir`, with an optional volume mounted at `/data`.
fn run_request(app_dir: &Path, deadline_ms: u64, volume: Option<&str>) -> ClientRequest {
    ClientRequest::Run {
        app_dir: app_dir.to_string_lossy().into_owned(),
        entrypoint: "main.js".into(),
        image: "base".into(),
        volumes: volume
            .into_iter()
            .map(|name| VolumeSpec { name: name.into(), mount: "/data".into() })
            .collect(),
        limits: Limits { deadline_ms, memory_mb: 128, max_life_ms: None },
        net: NetFlags { allow_loopback: false, allow_private: false, net_timeout: 10 },
        env: Vec::new(),
        args: Vec::new(),
        stdin: String::new(),
        publish: None,
        stream: false,
    }
}

/// The counter app's own answer, decoded to the number it wrote.
fn count(response: DaemonResponse) -> usize {
    let DaemonResponse::Ok { value, .. } = response else {
        panic!("the counter run did not complete: {response:?}");
    };
    value
        .split("count=")
        .nth(1)
        .and_then(|tail| tail.trim().parse().ok())
        .unwrap_or_else(|| panic!("no count in the counter app's answer: {value}"))
}

/// The app the timing test runs: nothing but a loop, so the deadline is what
/// ends it and the run's length is the deadline plus a fixed slack.
fn spin_app(dir: &Path) -> io::Result<PathBuf> {
    let app = dir.join("spin");
    std::fs::create_dir_all(&app)?;
    std::fs::write(app.join("main.js"), "let n = 0;\nwhile (true) { n++; }\n")?;
    Ok(app)
}

/// Run `work` on `n` scoped threads and collect what they came back with. A
/// panic inside a worker reaches the caller through `join`, so a failing worker
/// fails the test by name instead of vanishing into a channel nobody reads.
///
/// Every thread is spawned before any is joined: iterator adapters are lazy, so
/// spawning and joining in one chain would wait for each worker before starting
/// the next, and nothing would ever overlap.
fn parallel<T: Send>(n: usize, work: impl Fn() -> T + Sync) -> Vec<T> {
    thread::scope(|scope| {
        let handles: Vec<_> = (0..n).map(|_| scope.spawn(&work)).collect();
        handles
            .into_iter()
            .map(|handle| handle.join().expect("a worker thread panicked"))
            .collect()
    })
}

#[test]
fn a_wrong_token_gets_nothing_back() -> io::Result<()> {
    let daemon = Served::start(4)?;
    let (port, token) = daemon.endpoint()?;

    let mut stream = connect(port)?;
    // A token that cannot be right, of the same length so the comparison walks
    // every byte instead of returning early on length.
    let wrong = "0".repeat(token.len());
    let wrong = if wrong == token { "1".repeat(token.len()) } else { wrong };
    write_frame(&mut stream, &ClientRequest::Auth { token: wrong })?;
    write_frame(&mut stream, &ClientRequest::Images)?;

    // Every byte the daemon sent, until it closes. Silence is the property: a
    // single byte back would be an oracle for someone guessing the token. The
    // connection usually resets rather than shutting down cleanly, because the
    // frame we sent after the bad token is still queued for a socket that has
    // already been dropped — a reset carries no payload, which is all this
    // asserts; what must never happen is a frame back.
    let mut total = 0;
    let mut buf = [0u8; 256];
    loop {
        match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => total += n,
            Err(err)
                if [io::ErrorKind::UnexpectedEof, io::ErrorKind::ConnectionReset, io::ErrorKind::ConnectionAborted]
                    .contains(&err.kind()) =>
            {
                break
            }
            Err(err) => return Err(err),
        }
    }
    assert_eq!(total, 0, "a rejected token received a reply");
    Ok(())
}

#[test]
fn one_slot_takes_turns_on_one_volume() -> io::Result<()> {
    let daemon = Served::start(1)?;
    let (_, token) = daemon.endpoint()?;
    let app = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/apps/counter");
    let request = run_request(&app, 5000, Some("count"));

    // Three runs that all read and write the same count, started together. One
    // slot means they run one at a time, so the counts are 1, 2, and 3 in
    // whatever order they finished — never two of the same, which is what an
    // unserialised read-modify-write produces.
    let mut counts: Vec<usize> = parallel(3, || count(ask(&daemon, &token, &request).unwrap()));
    counts.sort_unstable();
    assert_eq!(counts, [1, 2, 3], "overlapping runs on one volume lost updates");
    Ok(())
}

#[test]
fn four_slots_run_four_in_the_time_of_one() -> io::Result<()> {
    let daemon = Served::start(4)?;
    let (_, token) = daemon.endpoint()?;
    let app = spin_app(&daemon.state_dir)?;
    let request = run_request(&app, SPIN_MS, None);

    let started = Instant::now();
    let replies: Vec<DaemonResponse> = parallel(4, || ask(&daemon, &token, &request).unwrap());
    let elapsed = started.elapsed();

    // Each reply must be a deadline, not an error: an app that failed to start
    // would finish fast and make the timing below meaningless.
    for reply in &replies {
        assert!(matches!(reply, DaemonResponse::TimedOut), "a spin run ended another way: {reply:?}");
    }

    // Four runs back to back would take at least four deadlines; overlapped,
    // barely more than one. The bar sits between those: loose enough for a
    // loaded machine, tight enough that a serial queue cannot pass.
    assert!(
        elapsed < Duration::from_millis(3 * SPIN_MS),
        "four runs on four slots took {elapsed:?}, which is not parallel",
    );
    Ok(())
}
