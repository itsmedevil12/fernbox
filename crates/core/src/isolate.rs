use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, Once};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

/// Limits applied to a single isolate execution.
pub struct ExecutionParams {
    /// Hard V8 heap limit in megabytes.
    pub memory_limit_mb: usize,
    /// Wall-clock budget. Exceeding it terminates the script.
    pub deadline: Duration,
}

/// Result of running a script in a fresh isolate.
pub enum Outcome {
    /// Script completed; its stringified return value.
    Completed(String),
    /// Script blew past its CPU deadline and was terminated.
    TimedOut,
    /// Script hit the heap limit and was terminated.
    OutOfMemory,
    /// Script failed to compile or threw.
    Failed(String),
}

static V8_INIT: Once = Once::new();

/// Bring up the V8 platform. Must run once, before any isolate is created.
pub fn init_v8() {
    V8_INIT.call_once(|| {
        let platform = v8::new_default_platform(0, false).make_shared();
        v8::V8::initialize_platform(platform);
        v8::V8::initialize();
    });
}

/// State handed to the near-heap-limit callback through its `data` pointer.
struct OomSignal {
    handle: v8::IsolateHandle,
    oom: Arc<AtomicBool>,
}

/// Without this, a script that blows the heap limit aborts the whole process:
/// `SetOOMErrorHandler` is informational-only, and V8 fatals once the handler
/// returns. The near-heap-limit callback fires first, so it raises the limit
/// just enough to unwind and terminates the script instead.
extern "C" fn near_heap_limit(
    data: *mut std::ffi::c_void,
    current_heap_limit: usize,
    _initial_heap_limit: usize,
) -> usize {
    let signal = unsafe { &*(data as *const OomSignal) };
    signal.oom.store(true, Ordering::SeqCst);
    signal.handle.terminate_execution();
    current_heap_limit + 16 * 1024 * 1024
}

/// Which limiter fired on a run that came back without a value.
pub enum Limiter {
    TimedOut,
    OutOfMemory,
    Neither,
}

/// An isolate with a hard heap limit and a CPU deadline.
///
/// The heap limit is set at construction and lives for the isolate's lifetime;
/// the deadline is armed per execution, since a long-lived isolate runs many
/// scripts. Both are enforced off-thread — an infinite loop or an allocation
/// spiral never hands control back to us.
pub struct Limited {
    pub isolate: v8::OwnedIsolate,
    timed_out: Arc<AtomicBool>,
    oom: Arc<AtomicBool>,
    max_heap: usize,
    signal: *mut OomSignal,
    cancel: Option<mpsc::Sender<()>>,
    watchdog: Option<JoinHandle<()>>,
    /// The instant the watchdog will kill at, shared with its thread so a run
    /// can renew it on activity. The watchdog re-reads it on every wake.
    deadline: Arc<Mutex<Instant>>,
    /// The latest instant a renewal may reach: the run's hard lifetime cap.
    /// Renewal clamps here, so activity can extend a run but never past it.
    hard_cap: Instant,
}

impl Limited {
    pub fn new(params: &ExecutionParams) -> Limited {
        let max_heap = params.memory_limit_mb * 1024 * 1024;
        let create_params = v8::CreateParams::default().heap_limits(0, max_heap);
        let mut isolate = v8::Isolate::new(create_params);

        let oom = Arc::new(AtomicBool::new(false));
        let signal = Box::into_raw(Box::new(OomSignal {
            handle: isolate.thread_safe_handle(),
            oom: oom.clone(),
        }));
        isolate.add_near_heap_limit_callback(near_heap_limit, signal as *mut _ as *mut _);

        Limited {
            isolate,
            timed_out: Arc::new(AtomicBool::new(false)),
            oom,
            max_heap,
            signal,
            cancel: None,
            watchdog: None,
            deadline: Arc::new(Mutex::new(Instant::now())),
            hard_cap: Instant::now(),
        }
    }

    /// Start the watchdog for one execution with a hard deadline. Disarm before
    /// the next run.
    pub fn arm(&mut self, deadline: Duration) {
        self.arm_with_cap(deadline, None);
    }

    /// Start the watchdog, allowing the deadline to be renewed on activity up to
    /// `max_life` past the start. `None` makes the deadline hard: the plain-run
    /// behaviour, where nothing extends it. A serving run passes its lifetime
    /// cap so each request it answers buys another idle budget, but the cap is
    /// the one thing renewal cannot move.
    pub fn arm_with_cap(&mut self, deadline: Duration, max_life: Option<Duration>) {
        self.disarm();

        let started = Instant::now();
        let hard_cap = started + max_life.unwrap_or(deadline);
        let kill_at = (started + deadline).min(hard_cap);
        *self.deadline.lock().unwrap() = kill_at;
        self.hard_cap = hard_cap;

        let handle = self.isolate.thread_safe_handle();
        let timed_out = self.timed_out.clone();
        let deadline = Arc::clone(&self.deadline);
        let (cancel_tx, cancel_rx) = mpsc::channel::<()>();
        let watchdog = std::thread::spawn(move || {
            // Wake at the deadline, then re-read it: a renewal during the sleep
            // moves the target, so the loop sleeps again rather than killing.
            // Only a wake that finds the deadline already past terminates.
            loop {
                let target = *deadline.lock().unwrap();
                let now = Instant::now();
                if now >= target {
                    // A timeout means the script is still running: kill it. The
                    // flag is set first so the runner can tell a deadline kill
                    // from a JS throw.
                    timed_out.store(true, Ordering::SeqCst);
                    handle.terminate_execution();
                    break;
                }
                match cancel_rx.recv_timeout(target - now) {
                    // Disarm sent the cancel, or dropped the sender: stand down.
                    Ok(()) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    // The wait elapsed; the deadline may have moved. Re-check.
                    Err(mpsc::RecvTimeoutError::Timeout) => continue,
                }
            }
        });

        self.cancel = Some(cancel_tx);
        self.watchdog = Some(watchdog);
    }

    /// Push the deadline out to `until`, clamped to the hard lifetime cap. The
    /// event loop calls this when a run does external work — serving a request —
    /// so an active service outlives its initial idle budget. A renewal already
    /// past the cap is a no-op: the cap is what bounds a run that keeps itself
    /// busy forever.
    pub fn renew(&self, until: Instant) {
        let mut deadline = self.deadline.lock().unwrap();
        let target = until.min(self.hard_cap);
        if target > *deadline {
            *deadline = target;
        }
    }

    /// Cancel the watchdog and report which limiter, if any, fired.
    ///
    /// The verdict is consumed: the flags are cleared here, not just read, so
    /// one run's timeout cannot be reported as the next run's. Every `arm`
    /// goes through here, so a fresh run always starts clean.
    pub fn disarm(&mut self) -> Limiter {
        if let Some(cancel) = self.cancel.take() {
            let _ = cancel.send(());
        }
        if let Some(watchdog) = self.watchdog.take() {
            let _ = watchdog.join();
        }
        let limiter = if self.timed_out.load(Ordering::SeqCst) {
            Limiter::TimedOut
        } else if self.oom.load(Ordering::SeqCst) {
            Limiter::OutOfMemory
        } else {
            Limiter::Neither
        };
        self.timed_out.store(false, Ordering::SeqCst);
        self.oom.store(false, Ordering::SeqCst);
        limiter
    }

    pub fn timed_out(&self) -> bool {
        self.timed_out.load(Ordering::SeqCst)
    }

    pub fn oom(&self) -> bool {
        self.oom.load(Ordering::SeqCst)
    }
}

impl Drop for Limited {
    fn drop(&mut self) {
        self.disarm();
        // Reap the watchdog and detach the callback before the isolate goes:
        // terminate_execution or a near-heap-limit callback against a dying
        // isolate would be unsound, and `signal` would dangle.
        self.isolate
            .remove_near_heap_limit_callback(near_heap_limit, self.max_heap);
        if !self.signal.is_null() {
            unsafe { drop(Box::from_raw(self.signal)) };
        }
    }
}

/// Run `source` in a throwaway isolate under the given limits.
pub fn run_script(source: &str, params: &ExecutionParams) -> Outcome {
    let mut limited = Limited::new(params);
    limited.arm(params.deadline);

    let value: Option<String> = {
        let scope = &mut v8::HandleScope::new(&mut limited.isolate);
        let context = v8::Context::new(scope);
        let scope = &mut v8::ContextScope::new(scope, context);

        let code = v8::String::new(scope, source);
        let script = code.and_then(|c| v8::Script::compile(scope, c, None));
        script
            .and_then(|s| s.run(scope))
            .map(|v| v.to_string(scope).map(|s| s.to_rust_string_lossy(scope)).unwrap_or_default())
    };

    match value {
        Some(text) => Outcome::Completed(text),
        None => match limited.disarm() {
            Limiter::TimedOut => Outcome::TimedOut,
            Limiter::OutOfMemory => Outcome::OutOfMemory,
            Limiter::Neither => Outcome::Failed("script threw or produced no value".into()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn limited() -> Limited {
        init_v8();
        Limited::new(&ExecutionParams { memory_limit_mb: 32, deadline: Duration::from_secs(1) })
    }

    #[test]
    fn a_plain_deadline_is_hard() {
        let mut l = limited();
        l.arm(Duration::from_millis(40));
        std::thread::sleep(Duration::from_millis(120));
        assert!(l.timed_out());
        assert!(matches!(l.disarm(), Limiter::TimedOut));
    }

    #[test]
    fn renewal_buys_another_idle_budget() {
        let mut l = limited();
        l.arm_with_cap(Duration::from_millis(60), Some(Duration::from_secs(5)));
        std::thread::sleep(Duration::from_millis(30));
        // Activity before the initial deadline pushes it out past the original.
        l.renew(Instant::now() + Duration::from_millis(300));
        std::thread::sleep(Duration::from_millis(120));
        assert!(!l.timed_out(), "a renewed deadline must not fire at the old instant");
        assert!(matches!(l.disarm(), Limiter::Neither));
    }

    #[test]
    fn the_hard_cap_bounds_renewal() {
        let mut l = limited();
        l.arm_with_cap(Duration::from_millis(40), Some(Duration::from_millis(120)));
        // A renewal reaching far past the cap is clamped to it.
        l.renew(Instant::now() + Duration::from_secs(60));
        std::thread::sleep(Duration::from_millis(220));
        assert!(l.timed_out(), "the cap must kill even a run that keeps renewing");
        assert!(matches!(l.disarm(), Limiter::TimedOut));
    }

    #[test]
    fn renewal_never_moves_the_deadline_earlier() {
        let mut l = limited();
        l.arm_with_cap(Duration::from_millis(200), Some(Duration::from_secs(5)));
        let before = *l.deadline.lock().unwrap();
        l.renew(Instant::now());
        assert_eq!(*l.deadline.lock().unwrap(), before);
        l.disarm();
    }
}
