// End-to-end check of the gated HTTP client.
//
// Spins up a real server on loopback and reaches it from inside the sandbox,
// which exercises the whole path: the user-context `fernbox.http.fetch`, the
// marshalled crossing, the virtual `/etc/hosts` lookup, the policy decision at
// connect time, and the response coming back as text.
//
// The redirect cases are the load-bearing ones. A chain that starts on an
// allowed address and then points at the metadata service must be refused at
// the second hop — that is the property that makes redirects a dead end rather
// than a way around the policy.
use fernbox_core::{
    init_v8, DirectNet, ExecutionParams, InstanceSeed, NetPolicy, Vm, VmOutcome,
};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

fn main() {
    init_v8();

    let listener = TcpListener::bind("127.0.0.1:0").expect("bind a local server");
    let port = listener.local_addr().unwrap().port();
    // The server polls rather than blocking on accept, so the main thread can
    // tell it to stop and actually be heard.
    let shutdown = Arc::new(AtomicBool::new(false));
    let server = {
        let shutdown = shutdown.clone();
        thread::spawn(move || serve(&listener, shutdown))
    };

    let params = ExecutionParams {
        memory_limit_mb: 128,
        deadline: Duration::from_secs(10),
    };
    let script = script_for(port);

    // Loopback is allowed: the instance reaches the server, but is still
    // refused the metadata address and unknown names.
    let seed = InstanceSeed::embedded("base").unwrap();
    let mut allowed = Vm::new(
        &params,
        &seed,
        Box::new(DirectNet(NetPolicy {
            allow_loopback: true,
            ..NetPolicy::default()
        })),
    )
    .expect("virtual OS booted");

    match allowed.run(&script, &params) {
        VmOutcome::Completed(value) => println!("loopback allowed:\n{value}"),
        other => panic!("the allowed run did not complete: {other:?}"),
    }

    // Loopback denied: the same script cannot reach the server at all.
    let mut denied = Vm::new(
        &params,
        &seed,
        Box::new(DirectNet(NetPolicy::default())),
    )
    .expect("virtual OS booted");
    match denied.run(&script, &params) {
        VmOutcome::Completed(value) => println!("loopback denied:\n{value}"),
        other => panic!("the denied run did not complete: {other:?}"),
    }

    shutdown.store(true, Ordering::SeqCst);
    let _ = server.join();
}

/// The script the sandbox runs. It writes its own `/etc/hosts` first, which is
/// how an instance opts a name into resolving, then probes each path.
fn script_for(port: u16) -> String {
    format!(
        r#"const results = {{}};
const attempt = (name, fn) => {{
  try {{ results[name] = "ok: " + JSON.stringify(fn()); }}
  catch (e) {{ results[name] = "threw: " + e.message; }}
}};

fernbox.write("/etc/hosts", "127.0.0.1 localtest\n");

attempt("local-get", () => fernbox.http.fetch("http://localtest:{port}/"));
attempt("local-redirect", () => fernbox.http.fetch("http://localtest:{port}/redirect-to-local"));
attempt("redirect-to-denied", () => fernbox.http.fetch("http://localtest:{port}/redirect-to-denied"));
attempt("unknown-host", () => fernbox.http.fetch("http://nope.invalid/"));
attempt("ip-literal-denied", () => fernbox.http.fetch("http://169.254.169.254/latest/meta-data/"));

JSON.stringify(results, null, 1);"#
    )
}

/// Serve the canned responses the script probes for.
fn serve(listener: &TcpListener, shutdown: Arc<AtomicBool>) {
    // Non-blocking so the shutdown flag is actually checked between connects.
    let _ = listener.set_nonblocking(true);
    while !shutdown.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = respond(&mut stream);
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(20));
            }
            Err(_) => break,
        }
    }
}

fn respond(stream: &mut TcpStream) -> std::io::Result<()> {
    let mut request = [0u8; 4096];
    let n = stream.read(&mut request)?;
    let request = String::from_utf8_lossy(&request[..n]);

    // Only the request line matters here.
    let target = request
        .split_whitespace()
        .nth(1)
        .unwrap_or("/")
        .to_string();

    match target.as_str() {
        "/redirect-to-local" => write_response(stream, 302, "Found", "/", "redirecting"),
        "/redirect-to-denied" => write_response(
            stream,
            302,
            "Found",
            "http://169.254.169.254/latest/meta-data/",
            "redirecting to the metadata service",
        ),
        _ => write_response(stream, 200, "OK", "", "hello from the real server"),
    }
}

fn write_response(
    stream: &mut TcpStream,
    status: u16,
    reason: &str,
    location: &str,
    body: &str,
) -> std::io::Result<()> {
    let mut head = format!("HTTP/1.1 {status} {reason}\r\nContent-Length: {}\r\n", body.len());
    if !location.is_empty() {
        head.push_str(&format!("Location: {location}\r\n"));
    }
    head.push_str("Connection: close\r\n\r\n");
    stream.write_all(head.as_bytes())?;
    stream.write_all(body.as_bytes())?;
    stream.flush()
}
