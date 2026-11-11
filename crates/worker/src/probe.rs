//! `fernbox-worker probe`: report this process's own restrictions.
//!
//! The daemon asks the OS for a restricted worker — a limited token, a job
//! object, no inherited handles. This is how anyone checks that the ask worked,
//! rather than trusting that the calls compiled. Two things are worth asking:
//! the integrity level the process runs at, and whether it can write beside its
//! own executable, which a low-integrity process cannot do to a
//! medium-integrity directory.

use std::path::PathBuf;
use std::process::ExitCode;

#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
#[cfg(windows)]
use windows_sys::Win32::Security::{
    GetTokenInformation, TokenIntegrityLevel, TOKEN_MANDATORY_LABEL, TOKEN_QUERY,
};
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

pub fn report() -> ExitCode {
    println!("integrity: {}", integrity_level());
    println!("write_beside_exe: {}", can_write_beside_exe());
    ExitCode::SUCCESS
}

/// A name for the mandatory integrity label on this process's token, or
/// `unknown` if it cannot be read — which is itself worth reporting.
#[cfg(windows)]
fn integrity_level() -> String {
    // The label's SID is `S-1-16-<rid>`; the rid is the single sub-authority,
    // and its value is what "low integrity" actually means.
    fn rid_of() -> Option<u32> {
        unsafe {
            let mut token: HANDLE = core::ptr::null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
                return None;
            }
            // The token is a real handle, unlike `GetCurrentProcess`'s pseudo
            // one, so it closes on every path out of here.
            let label = token_label(token);
            CloseHandle(token);
            let label = label?;

            let sid = label.Label.Sid as *const windows_sys::Win32::Security::SID;
            if (*sid).SubAuthorityCount == 0 {
                return None;
            }
            Some((*sid).SubAuthority[0])
        }
    }

    /// Query the token for its integrity label, allocating what it asks for.
    fn token_label(token: HANDLE) -> Option<TOKEN_MANDATORY_LABEL> {
        unsafe {
            let mut len = 0u32;
            GetTokenInformation(token, TokenIntegrityLevel, core::ptr::null_mut(), 0, &mut len);
            if len == 0 {
                return None;
            }
            let mut buffer = vec![0u8; len as usize];
            if GetTokenInformation(
                token,
                TokenIntegrityLevel,
                buffer.as_mut_ptr() as *mut _,
                len,
                &mut len,
            ) == 0
            {
                return None;
            }
            Some(core::ptr::read(buffer.as_ptr() as *const TOKEN_MANDATORY_LABEL))
        }
    }

    rid_of().map(name_of_rid).unwrap_or_else(|| "unknown".to_string())
}

#[cfg(not(windows))]
fn integrity_level() -> String {
    // Process restrictions are a Windows concern here; on POSIX the probe still
    // reports the write test, which is the observable half of the story.
    "unsupported".to_string()
}

#[cfg(windows)]
fn name_of_rid(rid: u32) -> String {
    // The names Windows itself uses, from winnt.h.
    match rid {
        0x0000 => "Untrusted".to_string(),
        0x1000 => "Low".to_string(),
        0x2000 => "Medium".to_string(),
        0x2100 => "MediumPlus".to_string(),
        0x3000 => "High".to_string(),
        0x4000 => "System".to_string(),
        other => format!("rid-{other}"),
    }
}

/// Try to write a file next to this executable. A restricted worker should fail
/// — its own directory is medium-integrity writable, which low integrity is not.
fn can_write_beside_exe() -> String {
    let Some(dir) = exe_directory() else {
        return "unknown".to_string();
    };
    let probe = dir.join("fernbox-probe-write.txt");
    match std::fs::write(&probe, b"probe") {
        Ok(()) => {
            let _ = std::fs::remove_file(&probe);
            "allowed".to_string()
        }
        Err(_) => "denied".to_string(),
    }
}

fn exe_directory() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(PathBuf::from))
}
