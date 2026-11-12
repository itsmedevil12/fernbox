//! Output reaches the caller while the script is still running.
//!
//! The claim under test is *liveness*, not completeness: a script that prints
//! one line, waits, then prints another must have its first line already in the
//! daemon's hands before the second exists. A test that only checked the final
//! `Done` payload would pass even if every chunk were buffered to the end, which
//! is exactly the behaviour this feature replaced.
//!
//! So the test watches the daemon's stderr, timestamping each line as it
//! arrives, and asserts the gaps match the script's own sleeps. That is the only
//! way to tell "streamed" from "printed at the end in the right order".
//!
//! Three things are checked:
//!
//! - output arrives *during* the run, spread out, not in one lump at the end;
//! - stdout and stderr stay distinguishable (`out` vs `err`);
//! - without `--stream` the daemon says nothing until the run finishes, so the
//!   flag is what turns this on rather than something always-on.

use std::io::{self, BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

use fernbox_proto::{read_frame, write_frame, ClientRequest, DaemonResponse, Limits, NetFlags};

/// One line the daemon wrote, with when it wrote it.
#[derive(Debug, Clone)]
struct Line {
    at: Duration,
    text: String,
}

/// A daemon whose stderr is being read line by line into a channel.
///
/// The start instant is captured before the process spawns, so every timestamp
/// is measured from the same origin the test's own clock uses.
struct Watched {
    child: Child,
    state_dir: PathBuf,
    lines: Receiver<Line>,
}

impl Watched {
    fn start(state_dir: PathBuf) -> io::Result<Watched> {
        std::fs::create_dir_all(&state_dir)?;
        let started = Instant::now();

        let mut child = Command::new(env!("CARGO_BIN_EXE_fernbox-daemon"))
            .arg("serve")
            .arg("--state-dir").arg(&state_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .env("CLICOLOR_FORCE", "1")
            .spawn()?;

        let stderr = child.stderr.take().expect("piped stderr");
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                // Escape codes are stripped here rather than at each assertion:
                // the test cares about the words, and colour is a terminal's
                // business.
                if tx.send(Line { at: started.elapsed(), text: strip_ansi(&line) }).is_err() {
                    break;
                }
            }
        });

        let daemon_json = state_dir.join("daemon.json");
        for _ in 0..200 {
            if daemon_json.is_file() {
                return Ok(Watched { child, state_dir, lines: rx });
            }
            thread::sleep(Duration::from_millis(50));
        }
        Err(io::Error::new(io::ErrorKind::TimedOut, "the daemon never wrote daemon.json"))
    }

    fn endpoint(&self) -> io::Result<(u16, String)> {
        let json: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(self.state_dir.join("daemon.json"))?)
                .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;
        let port = json["port"]
            .as_u64()
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "no port"))? as u16;
        let token = json["token"]
            .as_str()
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "no token"))?
            .to_string();
        Ok((port, token))
    }

    /// Collect lines until `settle` passes with no new ones arriving, then the
    /// run is over. A quiet daemon is the only "we are done" signal that does
    /// not require guessing a duration.
    fn drain(&self, settle: Duration) -> Vec<Line> {
        let mut out = Vec::new();
        loop {
            match self.lines.recv_timeout(settle) {
                Ok(line) => out.push(line),
                Err(_) => return out,
            }
        }
    }
}

impl Drop for Watched {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn strip_ansi(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars();
    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' {
            // Skip to the `m` that ends an SGR sequence.
            for c in chars.by_ref() {
                if c == 'm' {
                    break;
                }
            }
        } else {
            out.push(ch);
        }
    }
    out
}

fn unique_dir(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("{prefix}-{}-{nanos}", std::process::id()))
}

/// A script that prints a line, waits, and prints another. The waits are the
/// measurement: if the output is streamed, the arrivals are that far apart.
fn spaced_app(dir: &Path, count: usize, gap_ms: u64) -> io::Result<PathBuf> {
    let app = dir.join("app");
    std::fs::create_dir_all(&app)?;
    let script = format!(
        "for (let i = 1; i <= {count}; i++) {{\n  \
           console.log(\"tick \" + i);\n  \
           console.error(\"diag \" + i);\n  \
           const end = Date.now() + {gap_ms};\n  \
           while (Date.now() < end) {{}}\n\
         }}\n\
         \"done\";\n"
    );
    std::fs::write(app.join("main.js"), script)?;
    Ok(app)
}

fn run_request(app: &Path, stream: bool, deadline_ms: u64) -> ClientRequest {
    ClientRequest::Run {
        app_dir: app.to_string_lossy().into_owned(),
        entrypoint: "main.js".into(),
        image: "base".into(),
        volumes: Vec::new(),
        limits: Limits { deadline_ms, memory_mb: 128, max_life_ms: None },
        net: NetFlags { allow_loopback: false, allow_private: false, net_timeout: 10 },
        env: Vec::new(),
        args: Vec::new(),
        stdin: String::new(),
        publish: None,
        stream,
    }
}

fn ask(daemon: &Watched, token: &str, request: &ClientRequest) -> io::Result<DaemonResponse> {
    use std::net::{TcpStream, ToSocketAddrs};
    let (port, _) = daemon.endpoint()?;
    let addr = ("127.0.0.1", port).to_socket_addrs()?.next().unwrap();
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))?;
    stream.set_read_timeout(Some(Duration::from_secs(60)))?;
    write_frame(&mut stream, &ClientRequest::Auth { token: token.into() })?;
    write_frame(&mut stream, request)?;
    read_frame(&mut stream)?.ok_or_else(|| io::Error::new(io::ErrorKind::UnexpectedEof, "no reply"))
}

#[test]
fn streamed_output_arrives_during_the_run_not_at_the_end() {
    let state = unique_dir("fernbox-test-stream");
    let app = spaced_app(&state, 3, 400).expect("the app folder");
    let daemon = Watched::start(state).expect("the daemon");
    let (_, token) = daemon.endpoint().expect("the endpoint");

    let reply = ask(&daemon, &token, &run_request(&app, true, 5000)).expect("a reply");
    assert!(matches!(reply, DaemonResponse::Ok { .. }), "the run should complete: {reply:?}");

    let lines = daemon.drain(Duration::from_millis(400));
    let ticks: Vec<&Line> = lines.iter().filter(|line| line.text.contains("out  tick ")).collect();

    assert_eq!(ticks.len(), 3, "three ticks should be relayed, got: {lines:#?}");

    // The measurement that makes this a streaming test: the first tick must
    // have arrived well before the run could possibly have finished. Three
    // ticks 400ms apart is a ~1.2s run; anything past 900ms means the output
    // was held until the last sleep, not streamed through it.
    let first = ticks[0].at;
    assert!(
        first < Duration::from_millis(900),
        "the first tick arrived at {first:?}, which is too late to be streamed",
    );

    // And they must be spread out, matching the script's own gaps rather than
    // all landing together.
    let spread = ticks[2].at.saturating_sub(ticks[0].at);
    assert!(
        spread >= Duration::from_millis(600),
        "the ticks arrived {spread:?} apart in total, which is one lump, not a stream",
    );

    let _ = std::fs::remove_dir_all(daemon.state_dir.parent().unwrap_or(&daemon.state_dir));
}

#[test]
fn stdout_and_stderr_stay_distinguishable() {
    let state = unique_dir("fernbox-test-stream-streams");
    let app = spaced_app(&state, 2, 100).expect("the app folder");
    let daemon = Watched::start(state).expect("the daemon");
    let (_, token) = daemon.endpoint().expect("the endpoint");

    let reply = ask(&daemon, &token, &run_request(&app, true, 5000)).expect("a reply");
    assert!(matches!(reply, DaemonResponse::Ok { .. }), "the run should complete: {reply:?}");

    let lines = daemon.drain(Duration::from_millis(400));
    let out = lines.iter().filter(|line| line.text.contains("out  tick ")).count();
    let err = lines.iter().filter(|line| line.text.contains("err  diag ")).count();

    // Folding the two together would make `console.error` indistinguishable from
    // `console.log`, which is the whole reason the frame carries a discriminator.
    assert_eq!(out, 2, "two stdout lines expected: {lines:#?}");
    assert_eq!(err, 2, "two stderr lines expected: {lines:#?}");

    let _ = std::fs::remove_dir_all(daemon.state_dir.parent().unwrap_or(&daemon.state_dir));
}

#[test]
fn without_stream_the_daemon_stays_quiet_until_the_run_ends() {
    let state = unique_dir("fernbox-test-nostream");
    let app = spaced_app(&state, 2, 300).expect("the app folder");
    let daemon = Watched::start(state).expect("the daemon");
    let (_, token) = daemon.endpoint().expect("the endpoint");

    let started = Instant::now();
    let reply = ask(&daemon, &token, &run_request(&app, false, 5000)).expect("a reply");
    let elapsed = started.elapsed();
    assert!(matches!(reply, DaemonResponse::Ok { .. }), "the run should complete: {reply:?}");

    // The reply carries the whole of stdout, so nothing is lost by not
    // streaming — that is what makes the flag an optimization rather than a
    // different execution path.
    let DaemonResponse::Ok { output, .. } = reply else {
        unreachable!("asserted above");
    };
    assert!(output.contains("tick 1") && output.contains("tick 2"), "output: {output:?}");

    let lines = daemon.drain(Duration::from_millis(400));
    let streamed = lines
        .iter()
        .filter(|line| line.text.contains("out  tick ") || line.text.contains("err  diag "))
        .count();
    assert_eq!(streamed, 0, "no output should be relayed without --stream: {lines:#?}");

    // A sanity check on the harness itself: the run really did take long enough
    // that a streaming implementation would have had something to say early.
    assert!(elapsed >= Duration::from_millis(500), "the run finished in {elapsed:?}, too fast to judge");

    let _ = std::fs::remove_dir_all(daemon.state_dir.parent().unwrap_or(&daemon.state_dir));
}
