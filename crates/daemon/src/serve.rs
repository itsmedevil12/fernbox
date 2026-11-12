//! The loopback server: the daemon's only network surface.
//!
//! It binds loopback and nothing else, so the only processes that can reach it
//! are the user's own — and even they have to bring the token, which is written
//! to the state directory out of band. The first frame on a connection is the
//! authentication, compared in constant time; anything else gets no response at
//! all, because answering an unauthenticated peer would tell it something.
//!
//! One request per connection, then the connection closes. Nothing about a run
//! is worth keeping a socket open for, and a stateless server is one that cannot
//! be confused about who it is talking to.
//!
//! Concurrency lives here and nowhere else: each connection is its own task, so
//! two clients are inside `handle` at once, and a long run no longer makes a
//! `fernbox images` wait for it. A semaphore bounds how many of those are runs,
//! because a run holds a worker process for as long as its deadline allows —
//! without a cap, a queue of requests would fan out into a queue of processes.
//! Everything `handle` does is blocking, so it runs on `spawn_blocking` rather
//! than on a runtime thread: awaiting a worker inline would park that thread and
//! stall the very accept loop the runtime is here to keep moving.

use std::io;
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::Arc;

use fernbox_proto::ClientRequest;
use tokio::net::{TcpListener, TcpStream};
use tokio::runtime;
use tokio::sync::Semaphore;

use crate::frame::{read_frame_async, write_frame_async};
use crate::log;
use crate::state::Daemon;
use crate::{daemon, handle};

/// How many bytes the token holds. Enough that guessing is not a option, small
/// enough to read and compare without ceremony.
const TOKEN_BYTES: usize = 32;

/// `daemon.json`'s name, where the client finds the port and the token.
const DAEMON_JSON: &str = "daemon.json";

pub fn serve(override_dir: Option<&str>, port: Option<u16>, max_runs: usize) -> ExitCode {
    let daemon = match daemon(override_dir) {
        Ok(daemon) => daemon,
        Err(code) => return code,
    };

    let root = daemon.state().root().to_path_buf();
    if let Err(err) = std::fs::create_dir_all(&root) {
        eprintln!("error: cannot create {}: {err}", root.display());
        return ExitCode::from(5);
    }

    // The runtime is built here rather than hung on `main` with an attribute:
    // `main` also runs the local subcommands, which have no reason to spin one
    // up, and a runtime that never starts costs nothing.
    let runtime = match runtime::Builder::new_multi_thread().enable_all().build() {
        Ok(runtime) => runtime,
        Err(err) => {
            eprintln!("error: cannot start the runtime: {err}");
            return ExitCode::from(5);
        }
    };

    let listener = match runtime.block_on(async {
        TcpListener::bind(("127.0.0.1", port.unwrap_or(0))).await
    }) {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!("error: cannot bind 127.0.0.1: {err}");
            return ExitCode::from(5);
        }
    };
    let port = listener
        .local_addr()
        .expect("a bound listener has an address")
        .port();

    let token = match token() {
        Ok(token) => token,
        Err(err) => {
            eprintln!("error: cannot generate a token: {err}");
            return ExitCode::from(5);
        }
    };
    if let Err(err) = write_daemon_json(&root, port, &token) {
        eprintln!("error: {}: {err}", daemon_json(&root).display());
        return ExitCode::from(5);
    }

    log::banner(
        env!("CARGO_PKG_VERSION"),
        &[
            ("state", root.display().to_string()),
            ("token", daemon_json(&root).display().to_string()),
            ("address", format!("127.0.0.1:{port}")),
            ("runs", format!("{max_runs} at once; the rest queue")),
        ],
    );

    log::listen(
        &format!("127.0.0.1:{port}"),
        &format!("awaiting authenticated clients ({} slot{})", max_runs, if max_runs == 1 { "" } else { "s" }),
    );
    log::info("state", "state directory ready", Some(&root.display().to_string()));
    log::info("auth", "token written out of band", Some(&daemon_json(&root).display().to_string()));

    let daemon = Arc::new(daemon);
    let token = Arc::new(token);
    let slots = Arc::new(Semaphore::new(max_runs));

    runtime.block_on(async move {
        loop {
            // A peer that cannot even be accepted is not worth stopping the
            // daemon over; the next one may be the client.
            let (stream, _) = match listener.accept().await {
                Ok(pair) => pair,
                Err(_) => continue,
            };
            tokio::spawn(serve_connection(stream, Arc::clone(&token), Arc::clone(&daemon), Arc::clone(&slots)));
        }
    })
}

/// One connection: authenticate, handle one request, close.
async fn serve_connection(
    stream: TcpStream,
    token: Arc<String>,
    daemon: Arc<Daemon>,
    slots: Arc<Semaphore>,
) {
    let mut stream = stream;
    let _ = stream.set_nodelay(true);

    // The first frame must be `Auth` with the right token. A wrong one, a frame
    // that is not auth, or a closed stream all end the conversation the same
    // way: silently. Replying would only help someone guessing. Returning here
    // drops the stream, and nothing in tokio writes on drop, so the peer sees a
    // closed socket and nothing else.
    let offered = match read_frame_async::<_, ClientRequest>(&mut stream).await {
        Ok(Some(ClientRequest::Auth { token })) => token,
        _ => return,
    };
    if !same_token(&offered, &token) {
        return;
    }

    let request = match read_frame_async::<_, ClientRequest>(&mut stream).await {
        Ok(Some(request)) => request,
        _ => return,
    };

    // Only a run takes a slot: it is the only request that holds a worker
    // process. Acquiring after the token means an unauthenticated peer cannot
    // exhaust the slots by flooding, and the silence path costs nothing. An
    // owned permit, because the borrowed kind cannot cross into a blocking
    // closure.
    let permit = if matches!(request, ClientRequest::Run { .. }) {
        match Arc::clone(&slots).acquire_owned().await {
            Ok(permit) => Some(permit),
            // A closed semaphore means the daemon is shutting down; the request
            // is not going to be served either way.
            Err(_) => return,
        }
    } else {
        None
    };

    // `handle` blocks for as long as a worker runs, so it goes on a blocking
    // thread. The permit moves into the closure rather than living in this task:
    // if the task were dropped while a worker were still live, the slot would
    // free while the sandbox it counts is still running.
    let response = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        handle(&daemon, request)
    })
    .await;

    let response = match response {
        Ok(response) => response,
        // A panic in `handle` is a bug, not something a client can be told
        // about; the connection closing says enough.
        Err(_) => return,
    };

    // A client that has gone away does not get a second attempt; the response is
    // the last thing on this connection either way.
    let _ = write_frame_async(&mut stream, &response).await;
}

/// Compare two tokens without short-circuiting, so the time a comparison takes
/// leaks nothing about how much of the token a guess got right. Equal lengths is
/// arranged by the caller encoding both the same way; differing lengths fold to
/// a mismatch without an early return.
fn same_token(offered: &str, expected: &str) -> bool {
    let offered = offered.as_bytes();
    let expected = expected.as_bytes();
    if offered.len() != expected.len() {
        return false;
    }
    let mut differ: u8 = 0;
    for (a, b) in offered.iter().zip(expected) {
        differ |= a ^ b;
    }
    differ == 0
}

/// A fresh token as hex, the shape `daemon.json` stores and the client sends
/// back verbatim.
fn token() -> io::Result<String> {
    let mut bytes = [0u8; TOKEN_BYTES];
    getrandom::getrandom(&mut bytes)
        .map_err(|err| io::Error::other(format!("cannot read random bytes: {err}")))?;
    Ok(hex(&bytes))
}

fn hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

fn daemon_json(root: &std::path::Path) -> PathBuf {
    root.join(DAEMON_JSON)
}

/// Write `{port, token}` where the client looks for it, readable by the user
/// alone. On POSIX that is 0600; on Windows the state directory inherits the
/// profile's user-only ACL, which is what restricts it there.
fn write_daemon_json(root: &std::path::Path, port: u16, token: &str) -> io::Result<()> {
    let path = daemon_json(root);
    let json = format!("{{\n  \"port\": {port},\n  \"token\": \"{token}\"\n}}\n");
    std::fs::write(&path, json)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(&path)?;
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o600);
        std::fs::set_permissions(&path, permissions)?;
    }
    Ok(())
}
