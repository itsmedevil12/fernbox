//! The loopback gate: the daemon's published-port surface for a serving run.
//!
//! When a run is granted a port, the daemon binds 127.0.0.1:port and nothing
//! else, accepts a connection, buffers the whole request under hard byte limits,
//! and forwards it to the worker as base64 bytes. The worker's user realm parses
//! it and answers; the response comes back matched by id and is written to the
//! waiting connection verbatim. The daemon never parses HTTP beyond the framing
//! it needs to bound the read — the request line and headers are the worker's to
//! interpret, because the daemon is the trust root and parsing untrusted bytes
//! there is exactly what the two-process split exists to avoid.
//!
//! Loopback-only and open: the grant is the allowlist. There is no token on this
//! socket — the token guards the daemon's control port, not a service the user
//! chose to publish to their own machine. Binding loopback is what keeps it off
//! the network.
//!
//! Each accepted connection is its own thread, so one slow handler does not
//! block the accept loop. A connection count cap and a per-request timeout bound
//! what a local caller can fan out into, and the run's death drops every pending
//! response channel, which unblocks the waiters with a 503 rather than a hang.

use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;

use fernbox_proto::{write_frame, WorkerInput};

use crate::log;
use crate::spawn::WorkerStdin;

/// The most header bytes a request may carry before the blank line. Anything
/// larger is refused rather than buffered: a header flood must not become a
/// memory flood in the trust root.
const MAX_HEADER_BYTES: usize = 64 * 1024;
/// The most body bytes a request may carry. The worker's own limits still apply
/// beneath this; this is the gate's ceiling on what it will read at all.
const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;
/// How many connections may be in flight at once. Past this, a new connection
/// is answered 503 and closed, so a local caller cannot fan out into unbounded
/// threads.
const MAX_CONNECTIONS: usize = 64;
/// The backstop wait for a handler that never answers while the run is alive.
/// The run's death unblocks the wait sooner by dropping the response channel.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// The state the gate and the worker's run loop share: the pipe to the worker,
/// the table of pending responses, and the renewable deadline. Cloning shares
/// the same underlying locks, so the gate's writes and the run loop's routing
/// meet on one pipe and one table.
#[derive(Clone)]
pub struct Shared {
    pub stdin: Arc<Mutex<WorkerStdin>>,
    pub responses: Arc<Mutex<HashMap<u64, mpsc::Sender<String>>>>,
    pub deadline: Arc<Mutex<Instant>>,
    pub idle: Duration,
    pub hard_cap: Option<Instant>,
    /// Set once the run is over. A connection that arrives after this is
    /// answered 503 instead of being forwarded to a worker that will never
    /// answer, and the daemon clears the response table at the same moment.
    pub closed: Arc<AtomicBool>,
}

impl Shared {
    /// Push the deadline out to another idle budget, never past the hard cap and
    /// never earlier than it already is. Serving a request is the activity that
    /// buys a service more time, the same rule the worker's watchdog enforces.
    pub fn renew(&self) {
        let target = Instant::now() + self.idle;
        let target = match self.hard_cap {
            Some(cap) => target.min(cap),
            None => target,
        };
        let mut deadline = self.deadline.lock().unwrap();
        if target > *deadline {
            *deadline = target;
        }
    }
}

/// A running gate: the stop flag and the accept thread. Dropping it stops the
/// gate, so a run that finishes (or fails) never leaves a socket bound.
pub struct Gate {
    stop: Arc<AtomicBool>,
    addr: SocketAddr,
    accept: Option<JoinHandle<()>>,
}

impl Gate {
    /// Bind nothing here — the listener is bound by the caller so a port already
    /// in use is an error the run can report, not a thread that dies silently.
    pub fn spawn(listener: TcpListener, shared: Shared) -> io::Result<Gate> {
        let addr = listener.local_addr()?;
        let stop = Arc::new(AtomicBool::new(false));
        let active = Arc::new(AtomicUsize::new(0));
        let accept = {
            let stop = Arc::clone(&stop);
            let shared = shared.clone();
            std::thread::spawn(move || accept_loop(listener, shared, stop, active))
        };
        Ok(Gate { stop, addr, accept: Some(accept) })
    }

    /// Stop accepting and reap the accept thread. A self-connect wakes a blocking
    /// `accept` so this does not wait on a connection that may never come.
    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(self.addr);
        if let Some(handle) = self.accept.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for Gate {
    fn drop(&mut self) {
        self.stop();
    }
}

fn accept_loop(listener: TcpListener, shared: Shared, stop: Arc<AtomicBool>, active: Arc<AtomicUsize>) {
    let mut next_id = 1u64;
    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let (stream, _) = match listener.accept() {
            Ok(pair) => pair,
            Err(_) => continue,
        };
        if stop.load(Ordering::SeqCst) {
            break;
        }
        // Past the cap, refuse fast rather than spawn: the connection is answered
        // and closed on this thread, which is cheap and bounds the fan-out.
        if active.load(Ordering::SeqCst) >= MAX_CONNECTIONS {
            let mut stream = stream;
            let _ = stream.write_all(&http_error(503, "Service Unavailable"));
            continue;
        }
        let id = next_id;
        next_id = next_id.wrapping_add(1);
        active.fetch_add(1, Ordering::SeqCst);
        let shared = shared.clone();
        let stop = Arc::clone(&stop);
        let active = Arc::clone(&active);
        std::thread::spawn(move || {
            let _ = serve_connection(stream, id, shared, stop);
            active.fetch_sub(1, Ordering::SeqCst);
        });
    }
}

/// One connection: read the request, forward it, wait for the matching response,
/// write it back. Every exit path closes the connection — there is no keep-alive.
fn serve_connection(mut stream: TcpStream, id: u64, shared: Shared, stop: Arc<AtomicBool>) -> io::Result<()> {
    let _ = stream.set_nodelay(true);
    // A request is activity: it buys the run another idle budget before any work
    // is done, so a service that is being used stays up.
    shared.renew();

    let mut request_line = String::new();
    let raw = match read_request(&mut stream, &mut request_line) {
        Ok(raw) => raw,
        Err(response) => {
            // A framing refusal is answered here, in the gate, because it never
            // reached the worker. An empty read (the peer closed) gets no reply.
            if !response.is_empty() {
                let status = response
                    .split(|b| *b == b' ')
                    .nth(1)
                    .and_then(|s| std::str::from_utf8(s).ok())
                    .unwrap_or("???");
                log::rejected(status, &request_line);
                let _ = stream.write_all(&response);
            }
            return Ok(());
        }
    };
    log::inbound(&request_line, id, raw.len());
    if stop.load(Ordering::SeqCst) {
        return Ok(());
    }

    let (tx, rx) = mpsc::channel();
    {
        let mut responses = shared.responses.lock().unwrap();
        // The run ended between this connection being accepted and its request
        // being forwarded; a dead worker is a 503, not a request to wait on.
        if shared.closed.load(Ordering::SeqCst) {
            drop(responses);
            let _ = stream.write_all(&http_error(503, "Service Unavailable"));
            return Ok(());
        }
        responses.insert(id, tx);
    }

    let forwarded = WorkerInput::HttpRequest { id, raw_b64: STANDARD.encode(&raw) };
    let sent = {
        let mut stdin = shared.stdin.lock().unwrap();
        write_frame(&mut *stdin, &forwarded)
    };
    if sent.is_err() {
        shared.responses.lock().unwrap().remove(&id);
        let _ = stream.write_all(&http_error(503, "Service Unavailable"));
        return Ok(());
    }

    // Another idle budget once the request is on its way, so a slow handler that
    // is still making progress is not cut off by the daemon's wait.
    shared.renew();
    let answer = match rx.recv_timeout(REQUEST_TIMEOUT) {
        Ok(raw_b64) => STANDARD.decode(raw_b64).ok(),
        Err(RecvTimeoutError::Timeout) => None,
        // The run ended and dropped the table; there is no answer coming.
        Err(RecvTimeoutError::Disconnected) => None,
    };
    shared.responses.lock().unwrap().remove(&id);

    match answer {
        Some(bytes) => {
            // The status is the first three digits of the response line. The
            // gate does not otherwise read the worker's bytes, and this peek is
            // for the log alone — the bytes themselves go out untouched.
            let status = std::str::from_utf8(&bytes[..bytes.len().min(12)])
                .ok()
                .and_then(|s| s.split(' ').nth(1))
                .unwrap_or("???");
            log::outbound(status, &request_line, id, bytes.len());
            let _ = stream.write_all(&bytes);
        }
        None => {
            log::limit("http", &format!("no answer for #{id} within the timeout"), Some(&request_line));
            let _ = stream.write_all(&http_error(503, "Service Unavailable"));
        }
    }
    let _ = stream.flush();
    Ok(())
}

/// Buffer one whole request under the byte caps, or return the error response to
/// send instead. The body is framed by Content-Length; chunked transfer is
/// refused, because the gate forwards a single buffered request and has no
/// streaming path to decode it into.
///
/// The request line is handed back alongside the bytes so the log can name the
/// method and path. That is for the *log* only — the gate still does not
/// interpret the request beyond the framing it needs to bound the read — and it
/// is a borrowed slice of the buffer the caller already owns, so naming it costs
/// nothing.
fn read_request<'a>(stream: &mut TcpStream, line: &'a mut String) -> Result<Vec<u8>, Vec<u8>> {
    let mut buf: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 8192];
    let sep = loop {
        if let Some(pos) = find(&buf, b"\r\n\r\n") {
            break pos;
        }
        if buf.len() > MAX_HEADER_BYTES {
            return Err(http_error(431, "Request Header Fields Too Large"));
        }
        let n = match stream.read(&mut chunk) {
            Ok(n) => n,
            Err(_) => return Err(http_error(400, "Bad Request")),
        };
        if n == 0 {
            // A peer that closed before sending anything gets no reply; one that
            // closed mid-headers gets a 400.
            return Err(if buf.is_empty() { Vec::new() } else { http_error(400, "Bad Request") });
        }
        buf.extend_from_slice(&chunk[..n]);
    };

    let head = String::from_utf8_lossy(&buf[..sep]);
    let mut lines = head.split("\r\n");
    let request_line = lines.next().unwrap_or("");
    let parts: Vec<&str> = request_line.split(' ').collect();
    if parts.len() != 3 || !parts[2].starts_with("HTTP/") {
        return Err(http_error(400, "Bad Request"));
    }
    // `METHOD /path` with the version dropped, which is what a log line wants and
    // what the caller keeps for the duration of the connection.
    line.clear();
    line.push_str(parts[0]);
    line.push(' ');
    line.push_str(parts[1]);

    let mut content_length = 0usize;
    let mut chunked = false;
    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            match name.trim().to_ascii_lowercase().as_str() {
                "content-length" => content_length = value.trim().parse().unwrap_or(0),
                "transfer-encoding" => chunked = true,
                _ => {}
            }
        }
    }
    if chunked {
        return Err(http_error(501, "Not Implemented"));
    }
    if content_length > MAX_BODY_BYTES {
        return Err(http_error(413, "Payload Too Large"));
    }

    let body_start = sep + 4;
    while buf.len() - body_start < content_length {
        let n = match stream.read(&mut chunk) {
            Ok(n) => n,
            Err(_) => return Err(http_error(400, "Bad Request")),
        };
        if n == 0 {
            return Err(http_error(400, "Bad Request"));
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() - body_start > MAX_BODY_BYTES {
            return Err(http_error(413, "Payload Too Large"));
        }
    }
    // Exactly the framed request: anything pipelined behind it is not this
    // connection's to forward, since the worker answers one request per id.
    buf.truncate(body_start + content_length);
    Ok(buf)
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

/// A minimal, correctly framed error response. The gate answers framing failures
/// itself; everything else is the worker's response, written verbatim.
fn http_error(status: u16, reason: &str) -> Vec<u8> {
    let body = format!("{status} {reason}\n");
    format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
    .into_bytes()
}