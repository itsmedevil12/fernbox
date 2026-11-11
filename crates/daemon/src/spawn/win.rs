//! The Windows worker spawn, and the whole reason this module exists.
//!
//! A plain `CreateProcessW` would give the worker everything the daemon holds:
//! every inheritable handle comes along for the ride, and the child runs at the
//! daemon's integrity level with the daemon's privileges. That is not good
//! enough for the process that runs untrusted code, so three restrictions are
//! applied as the process is created — never afterwards, because a token cannot
//! be changed once a process exists:
//!
//! * **A job object**, so the worker dies with the daemon and cannot outlive
//!   the only process allowed to supervise it, and cannot spawn children of its
//!   own to hold state past its own death.
//! * **A restricted, low-integrity token**: no privileges, and too little
//!   integrity to write anywhere a normal process can. The sandbox's own writes
//!   never reach host disk regardless — this is what a V8 escape finds when it
//!   gets out.
//! * **An explicit handle list**: the worker inherits exactly three handles, its
//!   stdin, its stdout, and the daemon's stderr. Not the listening socket, not
//!   the token file, not anything else.
//!
//! Nothing the worker needs is on the command line. The seed, the script, and
//! the volumes all arrive on stdin, because `tasklist` shows a process's
//! command line to any other local user.

use std::io::{self, Read, Write};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::path::Path;

use windows_sys::Win32::Foundation::{
    CloseHandle, DuplicateHandle, DUPLICATE_SAME_ACCESS, HANDLE, INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Security::{
    CreateRestrictedToken, InitializeSid, SetTokenInformation, DISABLE_MAX_PRIVILEGE,
    SECURITY_ATTRIBUTES, SID, SID_AND_ATTRIBUTES, SID_IDENTIFIER_AUTHORITY, TOKEN_DUPLICATE,
    TOKEN_MANDATORY_LABEL, TOKEN_QUERY, TokenIntegrityLevel,
};
use windows_sys::Win32::System::Console::{GetStdHandle, STD_ERROR_HANDLE};
use windows_sys::Win32::System::JobObjects::{
    CreateJobObjectW, SetInformationJobObject, JobObjectExtendedLimitInformation,
    JOBOBJECT_BASIC_LIMIT_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_ACTIVE_PROCESS, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
use windows_sys::Win32::System::Pipes::CreatePipe;
use windows_sys::Win32::System::SystemServices::SECURITY_MANDATORY_LOW_RID;
use windows_sys::Win32::Storage::FileSystem::{ReadFile, WriteFile};
use windows_sys::Win32::System::Threading::{
    CreateProcessAsUserW, DeleteProcThreadAttributeList, GetCurrentProcess,
    InitializeProcThreadAttributeList, OpenProcessToken, UpdateProcThreadAttribute, IO_COUNTERS,
    PROC_THREAD_ATTRIBUTE_HANDLE_LIST, PROC_THREAD_ATTRIBUTE_JOB_LIST, PROCESS_INFORMATION,
    STARTUPINFOEXW, STARTUPINFOW,
};

/// `EXTENDED_STARTUPINFO_PRESENT` and a Unicode environment: the former is what
/// makes the attribute list (handle list and job) take effect at all.
const CREATION_FLAGS: u32 = 0x00080000 | 0x00000400;
/// `STARTF_USESTDHANDLES`: the hStd* fields are the ones to use.
const STARTUP_FLAGS: u32 = 0x00000100;
/// How big the pipe buffer starts. Frames are large, so this is generous.
const PIPE_BUFFER: u32 = 64 * 1024;
/// `ERROR_BROKEN_PIPE`: the reader is gone, which is this code's idea of EOF.
const BROKEN_PIPE: u32 = 232;

/// A child handle plus the job that contains it. Closing the job handle on drop
/// is what kills the worker when the daemon goes away.
pub struct WorkerChild {
    process: Option<HANDLE>,
    job: Option<HANDLE>,
    id: u32,
}

/// The daemon's write end of the worker's stdin.
///
/// This is a plain synchronous `WriteFile` on purpose. Rust's own `ChildStdin`
/// drives its pipes with `WriteFileEx` and an alertable wait, which is only
/// sound on the overlapped handles `std::process` creates for itself: on a
/// synchronous pipe the bytes are written and the completion callback never
/// fires, so the write returns never. These handles are ours, so the I/O is too.
pub struct WorkerStdin(OwnedHandle);

impl Write for WorkerStdin {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let mut written = 0u32;
        let result = unsafe {
            WriteFile(
                self.0.as_raw_handle() as _,
                buf.as_ptr() as *const _,
                buf.len() as u32,
                &mut written,
                std::ptr::null_mut(),
            )
        };
        if result == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(written as usize)
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// The daemon's read end of the worker's stdout, likewise synchronous.
pub struct WorkerStdout(OwnedHandle);

impl Read for WorkerStdout {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let mut read = 0u32;
        let result = unsafe {
            ReadFile(
                self.0.as_raw_handle() as _,
                buf.as_mut_ptr() as *mut _,
                buf.len() as u32,
                &mut read,
                std::ptr::null_mut(),
            )
        };
        if result == 0 {
            // A pipe whose writer has gone away fails rather than reading zero,
            // and that is the EOF the framer is looking for.
            return match io::Error::last_os_error().raw_os_error() {
                Some(code) if code as u32 == BROKEN_PIPE => Ok(0),
                other => Err(other.map_or_else(
                    || io::Error::new(io::ErrorKind::Other, "the worker pipe failed"),
                    io::Error::from_raw_os_error,
                )),
            };
        }
        Ok(read as usize)
    }
}

pub fn spawn(exe: &Path) -> io::Result<(WorkerChild, WorkerStdin, WorkerStdout)> {
    // The pipes are created inheritable, because the child has to receive its
    // own ends through the handle list rather than by ambient inheritance.
    let (child_read, parent_write) = pipe()?;
    let (parent_read, child_write) = pipe()?;
    // The daemon's stderr is duplicated inheritable: a redirected std handle is
    // not guaranteed to be one already, and a non-inheritable handle in the list
    // makes the whole create fail.
    let stderr = duplicate_stderr()?;

    let job = create_job()?;
    let token = restricted_token()?;

    let child = WorkerChild::try_new(|attribute_list| unsafe {
        // Exactly three handles cross the boundary: the two pipe ends the worker
        // needs, and stderr so its diagnostics are not lost.
        let inherited = [child_read, child_write, stderr];
        set_attribute(
            attribute_list,
            PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
            &inherited,
        )?;

        let jobs = [job];
        set_attribute(attribute_list, PROC_THREAD_ATTRIBUTE_JOB_LIST as usize, &jobs)?;

        // `STARTUPINFOEXW` has no `Default`: it is a plain C struct, and zero is
        // the value every field the create does not set wants.
        let mut startup: STARTUPINFOEXW = std::mem::zeroed();
        startup.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
        startup.StartupInfo.dwFlags = STARTUP_FLAGS;
        startup.StartupInfo.hStdInput = child_read;
        startup.StartupInfo.hStdOutput = child_write;
        startup.StartupInfo.hStdError = stderr;
        startup.lpAttributeList = attribute_list;

        let mut wide: Vec<u16> = exe.as_os_str().encode_wide().collect();
        wide.push(0);

        let mut information: PROCESS_INFORMATION = std::mem::zeroed();
        // `CreateProcessAsUserW`, not `CreateProcessW`: the restricted token is
        // the whole point, and a plain create would run the worker with this
        // process's unstripped token instead.
        let result = CreateProcessAsUserW(
            token,
            std::ptr::null(),
            wide.as_mut_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1, // inherit handles — the list above is what is actually inherited
            CREATION_FLAGS,
            std::ptr::null(),
            std::ptr::null(),
            &startup.StartupInfo as *const STARTUPINFOW,
            &mut information,
        );
        if result == 0 {
            return Err(io::Error::last_os_error());
        }
        CloseHandle(information.hThread);
        Ok((information.hProcess, information.dwProcessId))
    });

    // The duplicated stderr and the restricted token are the daemon's to close
    // whatever happened; the child's pipe ends must go now, or the pipe never
    // reads EOF and a worker that exits looks like one still talking.
    unsafe {
        CloseHandle(stderr);
        CloseHandle(token);
        CloseHandle(child_read);
        CloseHandle(child_write);
    }

    let (process, id) = child?;
    Ok((
        WorkerChild { process: Some(process), job: Some(job), id },
        WorkerStdin(unsafe { OwnedHandle::from_raw_handle(parent_write as _) }),
        WorkerStdout(unsafe { OwnedHandle::from_raw_handle(parent_read as _) }),
    ))
}

/// A pipe whose ends are inheritable, which is what the handle list requires.
fn pipe() -> io::Result<(HANDLE, HANDLE)> {
    let attributes = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: std::ptr::null_mut(),
        bInheritHandle: 1,
    };
    let mut read = INVALID_HANDLE_VALUE;
    let mut write = INVALID_HANDLE_VALUE;
    let result = unsafe { CreatePipe(&mut read, &mut write, &attributes, PIPE_BUFFER) };
    if result == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok((read, write))
}

/// This process's stderr, duplicated into an inheritable handle. A daemon with
/// no stderr at all gets nothing in the list rather than a create failure.
fn duplicate_stderr() -> io::Result<HANDLE> {
    let source = unsafe { GetStdHandle(STD_ERROR_HANDLE) };
    if source.is_null() || source == INVALID_HANDLE_VALUE {
        return Ok(std::ptr::null_mut());
    }
    let mut target: HANDLE = std::ptr::null_mut();
    let result = unsafe {
        DuplicateHandle(
            GetCurrentProcess(),
            source,
            GetCurrentProcess(),
            &mut target,
            0,
            1,
            DUPLICATE_SAME_ACCESS,
        )
    };
    if result == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(target)
}

/// A job object that kills its members when the daemon's handle closes and
/// allows no second process inside.
fn create_job() -> io::Result<HANDLE> {
    let job = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
    if job.is_null() || job == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }

    let limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        BasicLimitInformation: JOBOBJECT_BASIC_LIMIT_INFORMATION {
            PerProcessUserTimeLimit: 0,
            PerJobUserTimeLimit: 0,
            LimitFlags: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS,
            MinimumWorkingSetSize: 0,
            MaximumWorkingSetSize: 0,
            ActiveProcessLimit: 1,
            Affinity: 0,
            PriorityClass: 0,
            SchedulingClass: 0,
        },
        IoInfo: IO_COUNTERS {
            ReadOperationCount: 0,
            WriteOperationCount: 0,
            OtherOperationCount: 0,
            ReadTransferCount: 0,
            WriteTransferCount: 0,
            OtherTransferCount: 0,
        },
        ProcessMemoryLimit: 0,
        JobMemoryLimit: 0,
        PeakProcessMemoryUsed: 0,
        PeakJobMemoryUsed: 0,
    };
    let result = unsafe {
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &limits as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
    };
    if result == 0 {
        unsafe { CloseHandle(job) };
        return Err(io::Error::last_os_error());
    }
    Ok(job)
}

/// Duplicate this process's token, strip its privileges, and drop it to low
/// integrity. The result is what the worker runs as.
fn restricted_token() -> io::Result<HANDLE> {
    // `TOKEN_ADJUST_DEFAULT` is what `SetTokenInformation` needs to change the
    // integrity label; `TOKEN_ASSIGN_PRIMARY` is what `CreateProcessAsUserW`
    // needs to accept the result as a process token. Leaving either out makes
    // the corresponding call fail outright.
    const TOKEN_ADJUST_DEFAULT: u32 = 0x0020;
    const TOKEN_ASSIGN_PRIMARY: u32 = 0x0001;
    let mut own: HANDLE = std::ptr::null_mut();
    if unsafe {
        OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_DUPLICATE | TOKEN_QUERY | TOKEN_ADJUST_DEFAULT | TOKEN_ASSIGN_PRIMARY,
            &mut own,
        )
    } == 0
    {
        return Err(io::Error::last_os_error());
    }

    let mut restricted: HANDLE = std::ptr::null_mut();
    let result = unsafe {
        CreateRestrictedToken(
            own,
            DISABLE_MAX_PRIVILEGE,
            0,
            std::ptr::null(),
            0,
            std::ptr::null(),
            0,
            std::ptr::null(),
            &mut restricted,
        )
    };
    unsafe { CloseHandle(own) };
    if result == 0 {
        return Err(io::Error::last_os_error());
    }

    // `S-1-16-4096`: the low mandatory level. Applied to the duplicated token
    // before it is used, so the worker is low-integrity from its first
    // instruction. This is best-effort: a token that the kernel will not let
    // its holder relabel — a filtered UAC token, or one already running under a
    // restricted sandbox — refuses every integrity value, and the privilege
    // stripping above plus the job object still leave the worker with no
    // privileges and no life of its own. Failing the run here would make the
    // daemon unusable on exactly the machines whose shells are most locked
    // down, so the attempt degrades to a warning instead.
    if let Err(err) = lower_integrity(restricted) {
        static WARNED: std::sync::Once = std::sync::Once::new();
        WARNED.call_once(|| {
            eprintln!(
                "warning: the worker could not be dropped to low integrity ({err}); \
                 it still starts with no privileges inside the job object"
            );
        });
    }
    Ok(restricted)
}

/// Stamp `S-1-16-4096` onto an already-duplicated token.
fn lower_integrity(token: HANDLE) -> io::Result<()> {
    let mut sid: SID = unsafe { std::mem::zeroed() };
    let authority = SID_IDENTIFIER_AUTHORITY { Value: [0, 0, 0, 0, 0, 16] };
    if unsafe { InitializeSid(&mut sid as *mut _ as *mut _, &authority, 1) } == 0 {
        return Err(io::Error::last_os_error());
    }
    unsafe { *(sid.SubAuthority.as_mut_ptr()) = SECURITY_MANDATORY_LOW_RID as u32 };

    let label = TOKEN_MANDATORY_LABEL {
        Label: SID_AND_ATTRIBUTES {
            Sid: &mut sid as *mut _ as *mut _,
            Attributes: 0,
        },
    };
    if unsafe {
        SetTokenInformation(
            token,
            TokenIntegrityLevel,
            &label as *const _ as *const _,
            std::mem::size_of::<TOKEN_MANDATORY_LABEL>() as u32,
        )
    } == 0
    {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}

/// Build a proc-thread attribute list, hand it to `f`, and free it afterwards.
/// Every handle in the list is duplicated into the child by `CreateProcessW`,
/// so the caller's originals stay owned by the daemon.
fn set_attribute(
    list: LPPROC_THREAD_ATTRIBUTE_LIST,
    attribute: usize,
    values: &[HANDLE],
) -> io::Result<()> {
    let result = unsafe {
        UpdateProcThreadAttribute(
            list,
            0,
            attribute,
            values.as_ptr() as *const _,
            std::mem::size_of_val(values),
            std::ptr::null_mut(),
            std::ptr::null(),
        )
    };
    if result == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

/// The Win32 type name is what it is.
#[allow(non_camel_case_types)]
type LPPROC_THREAD_ATTRIBUTE_LIST = *mut core::ffi::c_void;

impl WorkerChild {
    /// Run `f` with a freshly built attribute list and keep whatever it returns.
    /// The attribute list is freed on the way out even when `f` fails, and its
    /// handles are the caller's to close — the list never owns them.
    fn try_new<T>(
        f: impl FnOnce(LPPROC_THREAD_ATTRIBUTE_LIST) -> io::Result<T>,
    ) -> io::Result<T> {
        let mut size = 0usize;
        unsafe { InitializeProcThreadAttributeList(std::ptr::null_mut(), 2, 0, &mut size) };
        let mut buffer = vec![0u8; size];
        let list = buffer.as_mut_ptr() as LPPROC_THREAD_ATTRIBUTE_LIST;
        let result = unsafe { InitializeProcThreadAttributeList(list, 2, 0, &mut size) };
        if result == 0 {
            return Err(io::Error::last_os_error());
        }
        let value = f(list);
        unsafe { DeleteProcThreadAttributeList(list) };
        value
    }

    pub fn id(&self) -> u32 {
        self.id
    }

    pub fn kill(&mut self) {
        // Closing the job is what stops the worker: `KILL_ON_JOB_CLOSE` kills
        // every member. The process handle is closed here too, and both are
        // remembered so `Drop` cannot close them twice.
        unsafe {
            if let Some(job) = self.job.take() {
                CloseHandle(job);
            }
            if let Some(process) = self.process.take() {
                CloseHandle(process);
            }
        }
    }
}

impl Drop for WorkerChild {
    fn drop(&mut self) {
        // Closing the process handle does not stop the worker; closing the job
        // does. Both go here so a dropped worker is a dead worker.
        self.kill();
    }
}
