//! The frame format, as the async socket sees it.
//!
//! [`fernbox_proto`] owns the one wire format and speaks it over anything
//! implementing `std::io::Read`. The daemon's listening socket is a
//! `tokio::net::TcpStream`, which implements `AsyncRead` instead, so the same
//! four-byte prefix is spoken here rather than there: putting tokio in the proto
//! crate would carry the runtime into the worker, the client, and the CLI, all
//! of which are blocking by design and none of which need it.
//!
//! The rules are identical to the synchronous ones, and deliberately so — a
//! frame is a frame whichever side reads it, and the cap is what keeps a hostile
//! peer from making us allocate forever.

use serde::de::DeserializeOwned;
use serde::Serialize;
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use fernbox_proto::MAX_FRAME_BYTES;

/// Read one message, or `None` at a clean end of the stream.
///
/// A short length prefix is an error rather than an empty message, because the
/// only honest sender writes a real one: a truncated prefix means the peer died
/// mid-write, and waiting for the rest would hang a connection task forever.
pub async fn read_frame_async<R: AsyncReadExt + Unpin, T: DeserializeOwned>(
    reader: &mut R,
) -> io::Result<Option<T>> {
    let mut prefix = [0u8; LEN_BYTES];
    match reader.read_exact(&mut prefix).await {
        Ok(_) => {}
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
    reader.read_exact(&mut bytes).await?;
    serde_json::from_slice(&bytes).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))
}

/// Write one message.
pub async fn write_frame_async<W: AsyncWriteExt + Unpin, T: Serialize>(
    writer: &mut W,
    message: &T,
) -> io::Result<()> {
    let bytes = serde_json::to_vec(message).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;
    if bytes.len() > MAX_FRAME_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("a {} byte message is over the {} byte cap", bytes.len(), MAX_FRAME_BYTES),
        ));
    }
    writer.write_all(&(bytes.len() as u32).to_be_bytes()).await?;
    writer.write_all(&bytes).await?;
    writer.flush().await
}

/// A frame is a `u32` length followed by that many bytes. Declared by the proto
/// crate; restated here so this module reads like the one it mirrors.
const LEN_BYTES: usize = 4;
