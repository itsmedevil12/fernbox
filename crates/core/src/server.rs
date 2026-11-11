//! The server-side plumbing: an incoming request the event loop dispatches, and
//! the sink that ships answers back out. The HTTP parsing itself lives in the
//! user realm's `http` builtin — these are only the bytes and the ids that cross
//! the boundary as strings, plus the one canned answer the event loop can give
//! without entering the user realm at all.

use base64::engine::general_purpose::STANDARD;
use base64::Engine;

/// A request the daemon's gate accepted, on its way into the isolate. `raw_b64`
/// is the whole request (request line, headers, body) base64-encoded; the user
/// realm decodes and parses it, never the daemon and never the system context.
#[derive(Debug, Clone)]
pub struct IncomingRequest {
    pub id: u64,
    pub raw_b64: String,
}

/// How the event loop ships a response: `(id, raw_b64)`. The worker's sink writes
/// a `WorkerMessage::HttpResponse` frame on the run thread; a test sink collects
/// them. Called only between callbacks, so it never races a fetch's own write.
pub type ResponseSink = Box<dyn FnMut(u64, String)>;

/// A canned 503 for a request that arrives with no server listening. Built here
/// so the event loop can answer without entering the user realm — a request that
/// finds no handler is the daemon's gate talking to an empty room, not the
/// script's business.
pub fn service_unavailable_b64() -> String {
    STANDARD.encode(
        b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    )
}