// The regression net for the fetch-deadline gap.
//
// A fetch blocks the V8 thread for as long as the peer takes. The CPU watchdog
// can terminate a runaway loop, but it cannot interrupt a syscall, so before
// the budget clamp a fetch started near the end of a run could hold the isolate
// hostage for the whole policy timeout — ten seconds past a one-second budget.
//
// This example starts a server that sleeps far longer than the run allows and
// asserts the run dies at its deadline rather than at the policy timeout. The
// gap is clamped, not made interruptible: the syscall still runs to ground, but
// the isolate is not parked waiting on it past the budget.
use fernbox_core::{init_v8, DirectNet, ExecutionParams, InstanceSeed, NetPolicy, Vm, VmOutcome};
use std::io::Write;
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

/// How long the run is allowed. Well under the policy timeout, so a pass here
/// can only mean the budget clamp fired.
const DEADLINE: Duration = Duration::from_secs(1);
/// The policy's own timeout. A run that takes this long means the clamp failed
/// and the peer's slowness set the schedule instead.
const POLICY_TIMEOUT: Duration = Duration::from_secs(10);
/// How long the server holds each connection. Longer than both, so the only way
/// the run ends early is its own deadline.
const SERVER_DELAY: Duration = Duration::from_secs(5);

fn main() {
    init_v8();

    let listener = TcpListener::bind("127.0.0.1:0").expect("bind a local server");
    let port = listener.local_addr().unwrap().port();
    let shutdown = Arc::new(AtomicBool::new(false));
    let server = {
        let shutdown = shutdown.clone();
        thread::spawn(move || serve(&listener, shutdown))
    };

    let params = ExecutionParams { memory_limit_mb: 128, deadline: DEADLINE };
    let script = format!(
        r#"fernbox.write("/etc/hosts", "127.0.0.1 slow\n");
fernbox.http.fetch("http://slow:{port}/");
"the fetch returned";"#
    );

    let seed = InstanceSeed::embedded("base").unwrap();
    let mut vm = Vm::new(
        &params,
        &seed,
        Box::new(DirectNet(NetPolicy {
            allow_loopback: true,
            request_timeout: POLICY_TIMEOUT,
            ..NetPolicy::default()
        })),
    )
    .expect("virtual OS booted");

    let started = Instant::now();
    let outcome = vm.run(&script, &params);
    let elapsed = started.elapsed();

    shutdown.store(true, Ordering::SeqCst);
    let _ = server.join();

    match outcome {
        VmOutcome::TimedOut => println!("timed out after {elapsed:?} (deadline {DEADLINE:?})"),
        other => panic!("the run should have hit its deadline, not {other:?}"),
    }

    // The load-bearing assertion: the run ends with its deadline, not with the
    // peer. Generous on the far side — the watchdog has to notice — but it must
    // be nowhere near the policy timeout.
    let limit = DEADLINE * 3;
    assert!(
        elapsed <= limit,
        "the run took {elapsed:?}, past the {limit:?} limit — the fetch outlived the deadline"
    );
    println!("ok: the fetch was clamped to the run's budget");
}

/// Accept one connection at a time and hold it longer than the run allows.
fn serve(listener: &TcpListener, shutdown: Arc<AtomicBool>) {
    let _ = listener.set_nonblocking(true);
    while !shutdown.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = std::io::read_to_string(&mut stream);
                thread::sleep(SERVER_DELAY);
                let _ = write_response(&mut stream);
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(20));
            }
            Err(_) => break,
        }
    }
}

fn write_response(stream: &mut TcpStream) -> std::io::Result<()> {
    let body = "too late";
    let head = format!(
        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes())?;
    stream.write_all(body.as_bytes())?;
    stream.flush()
}
