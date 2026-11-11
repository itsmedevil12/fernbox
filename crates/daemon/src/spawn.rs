//! Creating the worker process.
//!
//! This is the one place the daemon asks the operating system for a child, so
//! it is also the place the restrictions live. Two properties matter:
//!
//! * the worker inherits **only** its stdin and stdout — not the listening
//!   socket, not the token file, not anything else the daemon happens to hold;
//! * the command line carries no data. On Windows it is readable by other local
//!   users through `tasklist`, so the seed, the script, and the volumes travel
//!   on stdin instead.
//!
//! The Windows implementation in [`win`] builds the restricted process by hand
//! for those reasons. Other platforms get a plain `Command` for now: restricted
//! tokens and job objects are Windows constructs, and the project is
//! Windows-first by design.

use std::io;
use std::path::Path;

#[cfg(windows)]
mod win;

#[cfg(windows)]
use win as platform;

#[cfg(not(windows))]
mod posix;

#[cfg(not(windows))]
use posix as platform;

pub use platform::{WorkerChild, WorkerStdin, WorkerStdout};

/// Spawn the worker binary with no arguments at all, and give back the process
/// plus the two pipes to it.
pub fn spawn(exe: &Path) -> io::Result<(WorkerChild, WorkerStdin, WorkerStdout)> {
    platform::spawn(exe)
}
