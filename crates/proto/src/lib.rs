//! The wire format every FernBox component speaks.
//!
//! Three processes talk to each other and nothing else does:
//!
//! * the **client** (`fernbox-cli`, or the napi package later) asks the daemon
//!   to run an app, list images, or commit a volume;
//! * the **daemon** is the trust root: it owns the state directory and the
//!   network policy, and it never executes untrusted code;
//! * the **worker** is the expendable execution host, spawned per run and
//!   sandboxed, which sees the seed's bytes and nothing else.
//!
//! Every message is one frame: a four-byte big-endian length followed by that
//! many bytes of JSON. Length-prefixing means a reader never has to parse a
//! stream to find a boundary, and a writer's message is atomic on the wire.
//! Both matter on a pipe, where a worker's fetch reply and its final `Done`
//! would otherwise be indistinguishable from a single garbled blob.
//!
//! The cap is what keeps a hostile or broken peer from making us allocate
//! forever: a frame larger than [`MAX_FRAME_BYTES`] is refused and the
//! connection dropped, and the reader never buffers more than the cap.

use std::io::{self, Read, Write};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

/// A frame is a `u32` length followed by that many bytes.
const LEN_BYTES: usize = 4;

/// The largest message accepted. Deliberately above `FsPolicy::max_seed_bytes`
/// (64 MiB) so a seed always fits in a single frame; anything bigger has no
/// legitimate sender.
pub const MAX_FRAME_BYTES: usize = 96 * 1024 * 1024;

/// Read one message, or `None` at a clean end of the stream.
///
/// A short length prefix is an error rather than an empty message: the only
/// honest sender writes a real message, so a truncated prefix means the peer
/// died mid-write.
pub fn read_frame<R: Read, T: DeserializeOwned>(reader: &mut R) -> io::Result<Option<T>> {
    let mut prefix = [0u8; LEN_BYTES];
    match reader.read_exact(&mut prefix) {
        Ok(()) => {}
        Err(err) if err.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(err) => return Err(err),
    }

    let len = u32::from_be_bytes(prefix) as usize;
    if len > MAX_FRAME_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("a {len} byte frame is over the {} byte cap", MAX_FRAME_BYTES),
        ));
    }

    let mut bytes = vec![0u8; len];
    reader.read_exact(&mut bytes)?;
    serde_json::from_slice(&bytes).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))
}

/// Write one message.
pub fn write_frame<W: Write, T: Serialize>(writer: &mut W, message: &T) -> io::Result<()> {
    let bytes = serde_json::to_vec(message).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;
    if bytes.len() > MAX_FRAME_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("a {} byte message is over the {} byte cap", bytes.len(), MAX_FRAME_BYTES),
        ));
    }
    writer.write_all(&(bytes.len() as u32).to_be_bytes())?;
    writer.write_all(&bytes)?;
    writer.flush()
}

// --- the client ↔ daemon conversation --------------------------------------

/// A request from a client. `Auth` must be the first frame on a connection; the
/// rest are refused until it arrives.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientRequest {
    Auth { token: String },
    Run {
        /// Absolute, on the daemon's host: the daemon reads it, the client only
        /// names it. Relative paths are refused.
        app_dir: String,
        entrypoint: String,
        image: String,
        volumes: Vec<VolumeSpec>,
        limits: Limits,
        net: NetFlags,
        /// `KEY=VALUE` pairs, as a process receives its environment. The sandbox
        /// never sees the host's env; these are the caller's own values.
        env: Vec<String>,
        /// Arguments after the entrypoint. `process.argv` is
        /// `["node", entrypoint, ...args]`, so `argv.slice(2)` behaves.
        args: Vec<String>,
        /// The caller's stdin, as text. The whole of it arrives before the run
        /// starts, so a script reading `process.stdin` sees what was piped in
        /// and nothing typed live.
        stdin: String,
        /// A loopback port the caller grants this run to serve on. `None` means
        /// the run may not listen at all; `Some(port)` is the allowlist — the
        /// daemon binds 127.0.0.1:port for the run and forwards what arrives.
        publish: Option<u16>,
    },
    Images,
    Volumes,
    /// The files inside one volume, as `(path, byte_size)` pairs sorted by path.
    VolumeFiles {
        volume: String,
    },
    Commit {
        volume: String,
        image: String,
        /// The base image the frozen state is layered over. Defaults to `base`
        /// on the client side, so a bare `commit` still yields a runnable image.
        from: String,
    },
}

/// `NAME:MOUNT` as the client typed it, validated by the daemon before it
/// touches disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeSpec {
    pub name: String,
    pub mount: String,
}

/// The limits a run is held to, as they cross the wire.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Limits {
    pub deadline_ms: u64,
    pub memory_mb: usize,
    /// The hard lifetime cap for a serving run: the latest instant renewal on
    /// activity may reach. `None` makes `deadline_ms` hard (a plain run). Only
    /// meaningful when the run is granted a port to publish.
    pub max_life_ms: Option<u64>,
}

/// The network restrictions a client asks to lift. The daemon is free to refuse
/// — these are a request, not a grant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetFlags {
    pub allow_loopback: bool,
    pub allow_private: bool,
    pub net_timeout: u64,
}

/// The daemon's answer. `Ok` means the script ran and returned a value; the
/// others are the outcomes the sandbox itself can produce.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DaemonResponse {
    Ok {
        value: String,
        /// Everything the script wrote to its stdout, so `console.log` reaches
        /// the caller. Empty when it printed nothing.
        output: String,
    },
    Threw { message: String },
    Failed { message: String },
    TimedOut,
    OutOfMemory,
    Images { sources: Vec<(String, String)> },
    Volumes { names: Vec<String> },
    /// A volume's files, keyed by the path they held inside the sandbox and
    /// sized in bytes. Sorted by path so the client renders a stable tree.
    VolumeFiles { volume: String, files: Vec<(String, u64)> },
    Err { message: String },
}

// --- the daemon ↔ worker conversation --------------------------------------

/// The only thing the daemon ever sends a worker: everything an isolate needs
/// to boot, and nothing about the host it runs on. No policy, no paths, no
/// volume names — those stay with the daemon. `deny_unknown_fields` keeps it
/// that way: a field added on the daemon side that the worker would happily
/// accept (say, a policy) fails to decode instead of silently taking effect.
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkerRun {
    /// The image file map, already merged with the app layer, as the runtime's
    /// `globalThis.__fernbox_image` literal expects it.
    pub image: String,
    /// The volume mounts as the runtime's `__fernbox_volumes` literal expects
    /// them: `[{"mount": ..., "files": {...}}]`.
    pub volumes: String,
    /// The script source, read from the entrypoint by the daemon.
    pub script: String,
    /// The virtual path the entrypoint sits at, so the module layer can give the
    /// top level a real `__dirname`. Defaults to `/main.js`.
    pub entrypoint: String,
    /// `KEY=VALUE` pairs for `process.env`. Empty unless the caller set any.
    pub env: Vec<String>,
    /// Arguments after the entrypoint, for `process.argv.slice(2)`.
    pub args: Vec<String>,
    /// The caller's stdin, as the runtime's `process.stdin` reads it.
    pub stdin: String,
    pub memory_limit_mb: usize,
    pub deadline_ms: u64,
    /// The port this run is granted to serve on, if any. A grant, not a policy:
    /// the worker may listen on exactly this port and no other. `None` means
    /// listening is refused.
    pub publish: Option<u16>,
    /// The hard lifetime cap for a serving run, mirrored from `Limits`. The
    /// worker arms its watchdog with `deadline_ms` as the renewable idle budget
    /// and this as the ceiling renewal cannot pass. `None` makes the deadline
    /// hard, which is what a plain (non-serving) run wants.
    #[serde(default)]
    pub max_life_ms: Option<u64>,
}

/// What the worker says back. `Fetch` arrives while the script is running; the
/// daemon serves it and the worker continues. `Done` is last.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkerMessage {
    Fetch {
        hosts: String,
        url: String,
        method: String,
        headers: Vec<(String, String)>,
        body: Option<String>,
        /// How much of the run is left, in milliseconds. The daemon's policy
        /// timeout is the ceiling; this is what actually binds, so a fetch
        /// started at the end of a run ends with the run.
        budget_ms: u64,
    },
    Done {
        outcome: WorkerOutcome,
        /// The volume file maps as `__fernbox.snapshot` produced them:
        /// `[{"mount": ..., "files": {...}}]`. Untrusted until validated.
        ///
        /// `None` when the isolate never booted: there is no snapshot, and the
        /// daemon must leave the volumes alone. Sending an empty string would
        /// be indistinguishable from "the script wrote nothing", and would
        /// erase what the volumes already held.
        volumes: Option<String>,
    },
    /// A response to a forwarded HTTP request, matched to it by `id`. `raw_b64`
    /// is the whole response (status line, headers, body) base64-encoded, so a
    /// body of any bytes crosses the string-only boundary intact. The daemon
    /// decodes it and writes it to the waiting connection verbatim.
    HttpResponse { id: u64, raw_b64: String },
}

/// How the script ended, in the worker's own terms.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkerOutcome {
    Completed {
        value: String,
        /// What the script wrote to its stdout, reported alongside the value.
        output: String,
    },
    Threw { message: String },
    Failed { message: String },
    TimedOut,
    OutOfMemory,
}

/// The daemon's reply to a worker's fetch. Exactly one half is set: a response
/// or a refusal, never both.
#[derive(Debug, Serialize, Deserialize)]
pub struct FetchReply {
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Everything the daemon may send a worker after the seed: a fetch reply, or an
/// HTTP request to serve. The worker's reader thread tells them apart by the tag
/// and routes each to its own channel — fetch replies unblock a waiting fetch,
/// requests queue for the run's event loop.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkerInput {
    /// The answer to a `WorkerMessage::Fetch`. The newtype flattens the reply's
    /// fields beside the tag, so the wire shape stays `{type, result, error}`.
    Fetch(FetchReply),
    /// A request the daemon's gate accepted on the published port. `raw_b64` is
    /// the whole request (request line, headers, body) base64-encoded; the
    /// worker's user realm parses it, never the daemon. `id` matches the
    /// response the worker sends back.
    HttpRequest { id: u64, raw_b64: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_round_trip() {
        let mut buf = Vec::new();
        let request = ClientRequest::Volumes;
        write_frame(&mut buf, &request).unwrap();

        let mut cursor = std::io::Cursor::new(&buf);
        let back: ClientRequest = read_frame(&mut cursor).unwrap().unwrap();
        assert!(matches!(back, ClientRequest::Volumes));

        // A second read at the end of the buffer is a clean close, not an error.
        assert!(read_frame::<_, ClientRequest>(&mut cursor).unwrap().is_none());
    }

    #[test]
    fn oversized_frames_are_refused() {
        let big = DaemonResponse::Ok {
            value: "x".repeat(MAX_FRAME_BYTES + 1),
            output: String::new(),
        };
        // Encoding is allowed to succeed — the message is legitimate JSON — but
        // writing it must refuse, and the cap is what a reader enforces anyway.
        let encoded = serde_json::to_vec(&big).unwrap();
        assert!(encoded.len() > MAX_FRAME_BYTES);

        let mut sink = std::io::sink();
        assert!(write_frame(&mut sink, &big).is_err());

        // A hand-built over-long prefix is rejected on read without allocating.
        let mut hostile = Vec::new();
        hostile.extend_from_slice(&u32::MAX.to_be_bytes());
        let mut cursor = std::io::Cursor::new(hostile);
        assert!(read_frame::<_, ClientRequest>(&mut cursor).is_err());
    }

    #[test]
    fn truncated_frames_error_instead_of_hanging() {
        // A length prefix promising bytes that never come is an error, not a
        // blocked read: the peer is gone.
        let truncated = Vec::from(&[0u8, 0, 0, 10][..]);
        let mut cursor = std::io::Cursor::new(truncated);
        assert!(read_frame::<_, ClientRequest>(&mut cursor).is_err());
    }

    #[test]
    fn worker_run_carries_no_policy() {
        // The worker's message must not be able to carry a policy: deserialising
        // one with an extra field has to fail, so a daemon bug cannot leak it.
        // Every required field is present, so the unknown `policy` is the only
        // reason this can fail.
        let json = r#"{"image":"{}","volumes":"[]","script":"","entrypoint":"/main.js","env":[],"args":[],"stdin":"","memory_limit_mb":128,"deadline_ms":1000,"publish":null,"policy":{"allow_loopback":true}}"#;
        assert!(serde_json::from_str::<WorkerRun>(json).is_err());
    }

    #[test]
    fn worker_input_round_trips_both_shapes() {
        let fetch = WorkerInput::Fetch(FetchReply { result: None, error: Some("denied: x".into()) });
        let mut buf = Vec::new();
        write_frame(&mut buf, &fetch).unwrap();
        let back: WorkerInput = read_frame(&mut std::io::Cursor::new(&buf)).unwrap().unwrap();
        assert!(matches!(back, WorkerInput::Fetch(FetchReply { error: Some(e), .. }) if e == "denied: x"));

        let request = WorkerInput::HttpRequest { id: 7, raw_b64: "R0VU".into() };
        let mut buf = Vec::new();
        write_frame(&mut buf, &request).unwrap();
        let back: WorkerInput = read_frame(&mut std::io::Cursor::new(&buf)).unwrap().unwrap();
        assert!(matches!(back, WorkerInput::HttpRequest { id: 7, .. }));
    }

    #[test]
    fn volume_files_round_trip_with_sizes() {
        let request = ClientRequest::VolumeFiles { volume: "data".into() };
        let mut buf = Vec::new();
        write_frame(&mut buf, &request).unwrap();
        let back: ClientRequest = read_frame(&mut std::io::Cursor::new(&buf)).unwrap().unwrap();
        assert!(matches!(back, ClientRequest::VolumeFiles { volume } if volume == "data"));

        let reply = DaemonResponse::VolumeFiles {
            volume: "data".into(),
            files: vec![("/data/a".into(), 1), ("/data/b".into(), 22)],
        };
        let mut buf = Vec::new();
        write_frame(&mut buf, &reply).unwrap();
        let back: DaemonResponse = read_frame(&mut std::io::Cursor::new(&buf)).unwrap().unwrap();
        assert!(matches!(
            back,
            DaemonResponse::VolumeFiles { files, .. }
                if files == vec![("/data/a".into(), 1), ("/data/b".into(), 22)]
        ));
    }

    #[test]
    fn http_response_round_trips() {
        let message = WorkerMessage::HttpResponse { id: 42, raw_b64: "SFRUUC8xLjEgMjAwIE9L".into() };
        let mut buf = Vec::new();
        write_frame(&mut buf, &message).unwrap();
        let back: WorkerMessage = read_frame(&mut std::io::Cursor::new(&buf)).unwrap().unwrap();
        assert!(matches!(back, WorkerMessage::HttpResponse { id: 42, .. }));
    }
}
