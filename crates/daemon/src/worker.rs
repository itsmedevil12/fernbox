//! Driving one worker process through its RPC.
//!
//! The daemon composes a seed, hands it to a freshly spawned worker, and then
//! does three things until the worker is done: answer its fetches under the
//! network policy, route the HTTP responses it sends back to the gate's waiting
//! connections, and wait for the outcome. It never runs the script, never boots
//! an isolate, and never holds a V8 heap — that is the worker's job, and the
//! worker is the expendable end of this system.
//!
//! Every reply from the worker is untrusted by construction: it comes from a
//! process running untrusted code, so nothing it says is acted on without
//! validation where it matters. The volume file maps it reports are path-checked
//! and quota-checked before they are written, by the caller. A response frame is
//! matched to a pending request by id and otherwise dropped; an id the gate never
//! issued buys nothing.

use std::collections::HashMap;
use std::io;
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use fernbox_core::{gated_fetch, NetPolicy, NetRequest, OutputSink};
use fernbox_proto::{
    read_frame, write_frame, FetchReply, OutputStream, WorkerInput, WorkerMessage, WorkerOutcome,
    WorkerRun,
};

use crate::gate::{Gate, Shared};
use crate::spawn::{self, WorkerChild};

/// How long after the run's deadline the daemon keeps waiting for a `Done`.
/// V8 terminates at the deadline, but the worker still has to snapshot and write
/// the frame, so a worker that is merely finishing needs room; one that is
/// stuck gets killed instead of being waited on forever.
const SLACK: Duration = Duration::from_secs(10);

/// A live worker and the conversation with it.
pub struct Worker {
    child: WorkerChild,
    /// The pipe, the pending-response table, and the renewable deadline, shared
    /// with the gate so its writes and this loop's routing meet on one of each.
    shared: Shared,
    /// Messages from the worker, produced by a thread that owns its stdout. The
    /// channel is what bounds the wait: `recv_timeout` is the clamp, and a
    /// worker that says nothing for the rest of its budget is killed.
    messages: mpsc::Receiver<io::Result<Option<WorkerMessage>>>,
    /// The published-port gate, present only when the run was granted a port.
    gate: Option<Gate>,
    /// Where live output goes, when the caller asked for it. `None` is the
    /// default: the run's output arrives with `Done` and nowhere sooner.
    output: Option<OutputSink>,
}

impl Worker {
    /// Spawn a worker, hand it the run, and remember when its budget expires.
    /// A granted port is bound here, so a port already in use is an error the
    /// run reports rather than a gate that dies quietly in a thread.
    pub fn start(run: &WorkerRun) -> io::Result<Worker> {
        let exe = worker_exe()?;
        let idle = Duration::from_millis(run.deadline_ms);
        let started = Instant::now();
        let hard_cap = run.max_life_ms.map(|ms| started + Duration::from_millis(ms) + SLACK);
        let deadline = match hard_cap {
            Some(cap) => (started + idle + SLACK).min(cap),
            None => started + idle + SLACK,
        };

        let (child, stdin, stdout) = spawn::spawn(&exe)?;
        let mut stdin = stdin;
        write_frame(&mut stdin, run)?;
        // The seed is on the pipe; after this, only a fetch reply or a forwarded
        // request is ever written, and both go through the shared lock.

        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut stdout = stdout;
            loop {
                // `None` is a clean end of the pipe; an error is a truncated
                // frame or a broken one. Either way the conversation is over, and
                // the error is what the daemon reports.
                match read_frame::<_, WorkerMessage>(&mut stdout) {
                    Ok(message) => {
                        if tx.send(Ok(message)).is_err() {
                            // The daemon stopped listening; the run is over.
                            break;
                        }
                    }
                    Err(err) => {
                        let _ = tx.send(Err(err));
                        break;
                    }
                }
            }
        });

        let shared = Shared {
            stdin: Arc::new(Mutex::new(stdin)),
            responses: Arc::new(Mutex::new(HashMap::new())),
            deadline: Arc::new(Mutex::new(deadline)),
            idle,
            hard_cap,
            closed: Arc::new(AtomicBool::new(false)),
        };

        let gate = match run.publish {
            Some(port) => {
                let listener = TcpListener::bind(("127.0.0.1", port))?;
                Some(Gate::spawn(listener, shared.clone())?)
            }
            None => None,
        };

        Ok(Worker { child, shared, messages: rx, gate, output: None })
    }

    /// Hand the worker the sink that receives output as it is written.
    /// Set before `finish`; without it, output arrives only with the outcome.
    pub fn set_output_sink(&mut self, sink: OutputSink) {
        self.output = Some(sink);
    }

    /// The worker's process id, for diagnostics when one misbehaves.
    pub fn id(&self) -> u32 {
        self.child.id()
    }

    /// Take the worker's next message, answering fetches and routing responses
    /// on the way. Only a `Done` returns; `None` means the worker closed without
    /// a word.
    fn next(&mut self, policy: &NetPolicy) -> io::Result<Option<(WorkerOutcome, Option<String>)>> {
        loop {
            // The budget is the run's, recomputed each time so a slow fetch — or
            // a renewal the gate made while serving — leaves the next wait with
            // what is actually left.
            let deadline = *self.shared.deadline.lock().unwrap();
            let remaining = deadline.checked_duration_since(Instant::now()).unwrap_or_default();
            let message = match self.messages.recv_timeout(remaining) {
                Ok(message) => message?,
                Err(RecvTimeoutError::Timeout) => {
                    return Err(io::Error::new(
                        io::ErrorKind::TimedOut,
                        "the worker outlived its run's budget",
                    ));
                }
                // The reader thread ended, which it only does when the pipe did.
                Err(RecvTimeoutError::Disconnected) => return Ok(None),
            };

            match message {
                Some(fetch @ WorkerMessage::Fetch { .. }) => {
                    self.answer_fetch(fetch, policy)?;
                    // A fetch is not an outcome; go back and read again.
                }
                Some(WorkerMessage::HttpResponse { id, raw_b64 }) => {
                    // Hand the response to the gate connection waiting on this
                    // id. An id nobody is waiting on is dropped: the worker is
                    // untrusted, and a frame cannot conjure a connection.
                    if let Some(tx) = self.shared.responses.lock().unwrap().remove(&id) {
                        let _ = tx.send(raw_b64);
                    }
                }
                Some(WorkerMessage::Stdout { text, stream }) => {
                    // Live output, forwarded to whoever asked for it. A chunk
                    // with no sink is dropped: `Done` carries the whole of it
                    // anyway, so nothing is lost by ignoring the stream.
                    if let Some(sink) = self.output.as_mut() {
                        sink(&text, stream == OutputStream::Stdout);
                    }
                }
                Some(WorkerMessage::Done { outcome, volumes }) => return Ok(Some((outcome, volumes))),
                None => return Ok(None),
            }
        }
    }

    /// Serve one fetch under the policy and hand the answer back. The worker's
    /// stated budget is what bounds the request — it is the run's remaining time
    /// — and the policy's own timeout is the ceiling, applied inside
    /// `gated_fetch`.
    fn answer_fetch(&mut self, fetch: WorkerMessage, policy: &NetPolicy) -> io::Result<()> {
        let WorkerMessage::Fetch { hosts, url, method, headers, body, budget_ms } = fetch else {
            unreachable!("answer_fetch is called with a Fetch only");
        };

        let request = NetRequest { url, method, headers, body };
        let budget = Duration::from_millis(budget_ms);
        let reply = match gated_fetch(policy, &hosts, &request, budget) {
            Ok(response) => FetchReply {
                result: Some(serde_json::to_value(&response).unwrap_or(serde_json::Value::Null)),
                error: None,
            },
            Err(err) => FetchReply { result: None, error: Some(err.message()) },
        };
        // Tagged so the worker's reader can tell a reply from a forwarded
        // request on the same pipe.
        let mut stdin = self.shared.stdin.lock().unwrap();
        write_frame(&mut *stdin, &WorkerInput::Fetch(reply))
    }

    /// Wait for the worker's outcome and the volumes it claims to have written.
    /// The gate is stopped and the worker killed on the way out either way: it is
    /// a per-run process, and leaving one running would leave untrusted code with
    /// a live isolate — or a socket still bound to its port.
    pub fn finish(&mut self, policy: &NetPolicy) -> io::Result<(WorkerOutcome, Option<String>)> {
        let result = self.next(policy);
        if let Some(gate) = &mut self.gate {
            gate.stop();
        }
        self.child.kill();
        match result? {
            Some((outcome, volumes)) => Ok((outcome, volumes)),
            None => Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "the worker exited without reporting an outcome",
            )),
        }
    }
}

/// Where the worker binary is. `FERNBOX_WORKER` wins, so a dev tree and an
/// installed binary can both be found; otherwise the worker is expected beside
/// the daemon, which is how they ship.
fn worker_exe() -> io::Result<PathBuf> {
    if let Some(path) = std::env::var_os("FERNBOX_WORKER") {
        return Ok(PathBuf::from(path));
    }

    let exe = std::env::current_exe()?;
    let mut sibling = exe
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "the daemon has no directory"))?
        .to_path_buf();
    sibling.push(format!("fernbox-worker{}", std::env::consts::EXE_SUFFIX));
    Ok(sibling)
}

impl Drop for Worker {
    fn drop(&mut self) {
        // A worker that is still alive when this goes out of scope is one that
        // never finished cleanly. Stopping the gate frees the port and killing
        // the child is the last line of defence; the job object would get it
        // anyway when the daemon itself exits.
        //
        // No answer is coming for a connection still waiting on the gate:
        // draining the response table drops those senders, and the gate turns
        // the disconnect into a 503 at once instead of letting the connection
        // sit out its timeout.
        self.shared.closed.store(true, Ordering::SeqCst);
        if let Some(gate) = &mut self.gate {
            gate.stop();
        }
        self.shared.responses.lock().unwrap().clear();
        self.child.kill();
    }
}