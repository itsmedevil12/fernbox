//! The non-Windows worker spawn: a plain `Command`.
//!
//! No process restrictions are applied here. Job objects and restricted tokens
//! are Windows constructs, and a POSIX equivalent (pledge, seccomp, or a
//! separate user) is a different change; until it lands, a POSIX build of the
//! daemon is not a security boundary, only a functional one.

use std::io;
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

pub struct WorkerChild(Child);

/// The daemon's ends of the worker's stdio. On POSIX these are the handles
/// `std::process` made itself, so its pipe I/O is sound on them; the Windows
/// build makes its own and has to do its own I/O to match.
pub type WorkerStdin = ChildStdin;
pub type WorkerStdout = ChildStdout;

pub fn spawn(exe: &Path) -> io::Result<(WorkerChild, WorkerStdin, WorkerStdout)> {
    let mut child = Command::new(exe)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        // stderr is inherited: a worker's diagnostics are worth seeing in the
        // daemon's own output, and silencing them would hide a crash.
        .spawn()?;
    let stdin = child.stdin.take().expect("piped stdin");
    let stdout = child.stdout.take().expect("piped stdout");
    Ok((WorkerChild(child), stdin, stdout))
}

impl WorkerChild {
    pub fn id(&self) -> u32 {
        self.0.id()
    }

    pub fn kill(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
