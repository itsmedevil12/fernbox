//! Per-instance network policy and the gated HTTP client.
//!
//! The sandbox never gets a socket. Everything network-bound flows through this
//! module, and it enforces three properties that together make egress safe:
//!
//! 1. **Resolution is virtual.** A name resolves only if this instance's own
//!    `/etc/hosts` says so. There is no system DNS to fall back to, so an
//!    untrusted script cannot discover anything about the host's network beyond
//!    what its image and its own writes put in that file.
//! 2. **Policy is checked at connect time, per hop.** [`VirtualResolver`] is the
//!    hook ureq calls to ask "where do I connect?" — for the first request and
//!    for every redirect. A hop that resolves to a denied address is refused
//!    even when the hop before it was allowed, which is what makes redirect
//!    chains a dead end rather than a policy bypass.
//! 3. **Everything is capped.** Timeouts bound a hung peer, and bodies are
//!    size-limited on the way in and out so a hostile server cannot push
//!    unbounded data across the boundary.
//!
//! The `/etc/hosts` text is passed in per request rather than cached: the file
//! is live in the virtual filesystem and a write to it must take effect on the
//! next fetch. Parsing it fresh each time also keeps instances from sharing a
//! resolver's table — two instances in one process see two name spaces.

use std::io::Read;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use ureq::config::Config;
use ureq::http::uri::Authority;
use ureq::http::{Method, Request, Uri};
use ureq::unversioned::resolver::{Resolver, ResolvedSocketAddrs};
use ureq::unversioned::transport::{DefaultConnector, NextTimeout};
use ureq::{Agent, Error, ResponseExt};

/// The prefix a denial is carried under. ureq's `Error` has no generic "policy
/// refused" variant, so the resolver encodes one as a `BadUri` message and the
/// error mapping in [`gated_fetch`] decodes it. Both sides are in this file, so
/// the handshake stays private to the module.
const DENIED: &str = "denied: ";

/// How many lines of a virtual `/etc/hosts` are parsed. The file is
/// attacker-controlled (the sandbox can write it), so parsing it has to be
/// bounded.
const MAX_HOSTS_LINES: usize = 4096;

/// Network policy for one isolate. Denies everything sensitive by default; the
/// daemon lifts specific restrictions for instances that need them.
#[derive(Clone, Debug)]
pub struct NetPolicy {
    /// Allow 127.0.0.0/8 and ::1. Off by default because the daemon's control
    /// socket is on loopback and a sandbox must never be able to reach it.
    pub allow_loopback: bool,
    /// Allow RFC 1918 and unique-local addresses. Off by default: this is the
    /// SSRF surface, and an instance that needs an internal service opts in.
    pub allow_private: bool,
    /// Redirects ureq may follow. Each is re-resolved and re-checked, so this
    /// bounds the length of a chain rather than trusting the first hop.
    pub max_redirects: u32,
    /// Wall-clock budget for one fetch, covering every hop.
    pub request_timeout: Duration,
    /// Ceiling on a request or response body in bytes. 16 MiB is what a package
    /// tarball needs while staying an order of magnitude under the isolate's
    /// heap cap; the run's deadline is what bounds a big one in time.
    pub max_body_bytes: usize,
}

impl Default for NetPolicy {
    fn default() -> Self {
        NetPolicy {
            allow_loopback: false,
            allow_private: false,
            max_redirects: 5,
            request_timeout: Duration::from_secs(10),
            max_body_bytes: 16 * 1024 * 1024,
        }
    }
}

impl NetPolicy {
    /// Decide whether this instance may connect to `ip`. Link-local is never
    /// allowed: 169.254.169.254 and its neighbours are the cloud metadata
    /// service, and no instance should be able to read its host's credentials.
    fn check(&self, ip: IpAddr) -> Result<(), String> {
        match classify(ip) {
            IpClass::LinkLocal => Err("link-local addresses are never allowed".into()),
            IpClass::Loopback if !self.allow_loopback => Err("loopback is not allowed".into()),
            IpClass::Private if !self.allow_private => Err("private addresses are not allowed".into()),
            // RFC 5737 documentation ranges: unroutable on the real internet, and
            // the space a virtual host is mapped to when it has no backing
            // service. There is nothing to connect to, so it is refused here.
            IpClass::Synthetic => Err("synthetic (RFC 5737) addresses have no backing service".into()),
            _ => Ok(()),
        }
    }
}

/// What kind of network an address belongs to. Order matters in [`classify`]:
/// the v4 and v6 branches handle the mapped forms of each other so a sandbox
/// cannot reach a denied v4 address by spelling it as v6.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IpClass {
    /// 127.0.0.0/8, 0.0.0.0/8, ::1, ::.
    Loopback,
    /// 169.254.0.0/16 and fe80::/10, including the cloud metadata endpoint.
    LinkLocal,
    /// RFC 1918 and IPv6 unique-local ranges.
    Private,
    /// RFC 5737 documentation ranges, used for virtual hosts.
    Synthetic,
    /// Globally routable.
    Public,
}

pub fn classify(ip: IpAddr) -> IpClass {
    match ip {
        IpAddr::V4(v4) => classify_v4(v4),
        // An IPv4 address spelled in v6 clothing is still that v4 address: the
        // OS routes ::ffff:169.254.169.254 to the metadata service just as well.
        IpAddr::V6(v6) => embedded_v4(&v6).map(classify_v4).unwrap_or(classify_v6(&v6)),
    }
}

fn classify_v4(ip: Ipv4Addr) -> IpClass {
    match ip.octets() {
        [0, _, _, _] | [127, _, _, _] => IpClass::Loopback,
        [169, 254, _, _] => IpClass::LinkLocal,
        [172, b, _, _] if (16..=31).contains(&b) => IpClass::Private,
        [10, _, _, _] | [192, 168, _, _] => IpClass::Private,
        [192, 0, 2, _] | [198, 51, 100, _] | [203, 0, 113, _] => IpClass::Synthetic,
        _ => IpClass::Public,
    }
}

fn classify_v6(ip: &Ipv6Addr) -> IpClass {
    let s = ip.segments();
    match s {
        [0, 0, 0, 0, 0, 0, 0, 0] | [0, 0, 0, 0, 0, 0, 0, 1] => IpClass::Loopback,
        _ if s[0] & 0xffc0 == 0xfe80 => IpClass::LinkLocal, // fe80::/10
        _ if s[0] & 0xfe00 == 0xfc00 => IpClass::Private,   // fc00::/7
        _ if s[0] == 0x2001 && s[1] == 0x0db8 => IpClass::Synthetic,
        _ => IpClass::Public,
    }
}

/// The v4 address inside an IPv4-mapped (`::ffff:a.b.c.d`) or IPv4-compatible
/// (`::a.b.c.d`) address, if any.
fn embedded_v4(ip: &Ipv6Addr) -> Option<Ipv4Addr> {
    let s = ip.segments();
    let mapped = s[..5] == [0; 5] && s[5] == 0xffff;
    // Compatible form is deprecated but still routed; :: and ::1 are not v4.
    let compatible = s[..6] == [0; 6] && s[6] != 0;
    if mapped || compatible {
        Some(Ipv4Addr::new(
            (s[6] >> 8) as u8,
            s[6] as u8,
            (s[7] >> 8) as u8,
            s[7] as u8,
        ))
    } else {
        None
    }
}

/// A virtual `/etc/hosts` parsed into a name→address table.
///
/// Follows the hosts-file convention that the first entry for a name wins, so
/// the image's mapping cannot be shadowed by a later duplicate.
#[derive(Debug, Default)]
struct HostsTable {
    names: std::collections::HashMap<String, IpAddr>,
}

impl HostsTable {
    fn parse(text: &str) -> HostsTable {
        let mut table = HostsTable::default();
        for line in text.lines().take(MAX_HOSTS_LINES) {
            let line = line.split('#').next().unwrap_or("").trim();
            let mut fields = line.split_whitespace();
            let Some(addr) = fields.next().and_then(|s| s.parse::<IpAddr>().ok()) else {
                continue;
            };
            for name in fields {
                // Lowercased once so lookups are case-insensitive.
                table.names.entry(name.to_lowercase()).or_insert(addr);
            }
        }
        table
    }

    fn lookup(&self, host: &str) -> Option<IpAddr> {
        self.names.get(&host.to_lowercase()).copied()
    }
}

/// The resolver ureq asks for a connection target. This is the single point
/// where a name becomes an address, which is why policy lives here rather than
/// in the request path: it runs for the initial request and for every redirect.
#[derive(Debug)]
struct VirtualResolver {
    hosts: HostsTable,
    policy: NetPolicy,
}

impl Resolver for VirtualResolver {
    fn resolve(
        &self,
        uri: &Uri,
        _config: &Config,
        _timeout: NextTimeout,
    ) -> Result<ResolvedSocketAddrs, Error> {
        let scheme = uri.scheme().ok_or_else(|| Error::BadUri("missing scheme".into()))?;
        let authority = uri
            .authority()
            .ok_or_else(|| Error::BadUri("missing authority".into()))?;

        if scheme.as_str() != "http" && scheme.as_str() != "https" {
            return Err(Error::BadUri(format!("unsupported scheme: {}", scheme)));
        }

        let ip = resolve_host(&self.hosts, authority)?;
        // The policy decision itself. Denied here, the connection is never
        // attempted; a denial survives to the caller as NetError::Denied.
        self.policy
            .check(ip)
            .map_err(|reason| Error::BadUri(format!("{DENIED}{reason}")))?;

        let port = authority
            .port_u16()
            .unwrap_or(if scheme.as_str() == "https" { 443 } else { 80 });

        let mut addrs = self.empty();
        addrs.push(SocketAddr::new(ip, port));
        Ok(addrs)
    }
}

/// An IP literal resolves to itself and is policy-checked like any other
/// address; a name must appear in this instance's virtual hosts. Anything else
/// is unknown, which is what "DNS offline" means in practice.
fn resolve_host(hosts: &HostsTable, authority: &Authority) -> Result<IpAddr, Error> {
    let host = authority.host();
    host.parse::<IpAddr>()
        .ok()
        .or_else(|| hosts.lookup(host))
        .ok_or(Error::HostNotFound)
}

/// A fetch as seen by the Rust side: already-marshalled, typed, no handles.
pub struct NetRequest {
    pub url: String,
    pub method: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
}

/// A fetch result. Serialised to JSON and handed back across the boundary as a
/// single string, so no object ever crosses realms. It deserialises too,
/// because the worker receives it as JSON from the daemon and has to turn it
/// back into the same shape.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct NetResponse {
    pub status: u16,
    /// The URL the response finally came from, after any redirects.
    pub url: String,
    pub headers: Vec<(String, String)>,
    /// The body as text. Lossy when the bytes are not UTF-8, which is the right
    /// thing for an HTML error page and wrong for a tarball — see `body_b64`.
    pub body: String,
    /// The body as base64, set only when it is not valid UTF-8. The boundary is
    /// still a string either way; this is how a gzip tarball crosses it without
    /// being mangled, at the cost of a third again in size. Text responses get
    /// `None`, so nothing that reads `body` today changes shape.
    pub body_b64: Option<String>,
}

/// Why a fetch did not come back.
#[derive(Debug)]
pub enum NetError {
    /// Policy refused to connect; the string says which class was denied.
    Denied(String),
    /// The name is unknown to this instance's virtual hosts.
    HostNotFound,
    BadUri(String),
    Method(String),
    TooManyRedirects,
    Timeout,
    BodyTooLarge,
    Transport(String),
}

impl NetError {
    pub fn message(&self) -> String {
        match self {
            NetError::Denied(reason) => format!("denied: {reason}"),
            NetError::HostNotFound => "host not found (DNS is offline; add it to /etc/hosts)".into(),
            NetError::BadUri(reason) => format!("bad url: {reason}"),
            NetError::Method(reason) => format!("bad method: {reason}"),
            NetError::TooManyRedirects => "too many redirects".into(),
            NetError::Timeout => "the request timed out".into(),
            NetError::BodyTooLarge => "the body exceeded the size limit".into(),
            NetError::Transport(reason) => format!("transport error: {reason}"),
        }
    }
}

/// Where a fetch is actually served. The isolate's callback hands a marshalled
/// request to this trait and gets a marshalled answer back, so the two halves of
/// the network boundary stay split: the caller supplies the virtual hosts text
/// and the remaining run budget, the implementation applies the policy.
///
/// There are two implementations. [`DirectNet`] calls `gated_fetch` in-process —
/// the policy table and the ureq client live where the isolate is. The worker
/// process uses its own backend instead, framing the request to the daemon over
/// stdin/stdout, because the worker must never hold the policy itself: the
/// daemon is the single policy authority, and a compromised worker has nothing
/// to bend.
pub trait NetBackend {
    fn fetch(
        &mut self,
        hosts: &str,
        request: &NetRequest,
        budget: Duration,
    ) -> Result<NetResponse, NetError>;
}

/// Serve fetches in-process, under this policy. Used by the bare execution paths
/// — the examples and the worker's `sandbox` mode — where the isolate and the
/// policy live in the same process by design.
pub struct DirectNet(pub NetPolicy);

impl NetBackend for DirectNet {
    fn fetch(
        &mut self,
        hosts: &str,
        request: &NetRequest,
        budget: Duration,
    ) -> Result<NetResponse, NetError> {
        gated_fetch(&self.0, hosts, request, budget)
    }
}

/// Run one gated fetch. The hosts text is the instance's current `/etc/hosts`,
/// supplied by the caller each time so a write to it takes effect immediately.
///
/// `budget` is how long this one fetch may take, on top of the policy's own
/// timeout: it is the calling run's remaining time, so a fetch started near the
/// script's CPU deadline ends with the run instead of outliving it by the whole
/// policy timeout. The CPU watchdog cannot interrupt a syscall — this clamp is
/// what bounds the hang.
pub fn gated_fetch(
    policy: &NetPolicy,
    hosts_text: &str,
    request: &NetRequest,
    budget: Duration,
) -> Result<NetResponse, NetError> {
    if request
        .body
        .as_ref()
        .is_some_and(|body| body.len() > policy.max_body_bytes)
    {
        return Err(NetError::BodyTooLarge);
    }

    // A run with no time left has no business starting a request at all.
    let timeout = policy.request_timeout.min(budget);
    if timeout.is_zero() {
        return Err(NetError::Timeout);
    }

    let method = Method::from_bytes(request.method.as_bytes())
        .map_err(|e| NetError::Method(e.to_string()))?;

    // http_status_as_error is off so the script sees 4xx and 5xx as responses
    // rather than as fetch failures — the policy layer decides what is allowed,
    // not the remote server's mood.
    let config = Config::builder()
        .http_status_as_error(false)
        .max_redirects(policy.max_redirects)
        .timeout_global(Some(timeout))
        .save_redirect_history(true)
        .build();

    // A fresh agent per request: the hosts table and policy are per-instance and
    // per-call, and pooling connections across those would share state that must
    // stay separate.
    let agent = Agent::with_parts(
        config,
        DefaultConnector::new(),
        VirtualResolver {
            hosts: HostsTable::parse(hosts_text),
            policy: policy.clone(),
        },
    );

    let mut builder = Request::builder().method(method).uri(&request.url);
    for (name, value) in &request.headers {
        builder = builder.header(name, value);
    }
    let body = request.body.clone().unwrap_or_default();
    let request = builder
        .body(body)
        .map_err(|e| NetError::BadUri(e.to_string()))?;

    let mut response = agent.run(request).map_err(map_ureq_error)?;

    let mut reader = response.body_mut().as_reader();
    let mut body = Vec::with_capacity(1024);
    // One byte past the limit distinguishes "exactly at the limit" from "over".
    reader
        .by_ref()
        .take(policy.max_body_bytes as u64 + 1)
        .read_to_end(&mut body)
        .map_err(|e| NetError::Transport(e.to_string()))?;
    if body.len() > policy.max_body_bytes {
        return Err(NetError::BodyTooLarge);
    }

    // A body that is not UTF-8 cannot be carried as text without losing bytes,
    // so it goes alongside as base64 and the caller picks. `from_utf8` is the
    // test rather than a content-type sniff: the registry's tarball is served
    // as `application/octet-stream`, but a small one could happen to be valid
    // UTF-8, and then either field decodes to the same bytes.
    let (body, body_b64) = match String::from_utf8(body.clone()) {
        Ok(text) => (text, None),
        Err(_) => (
            String::from_utf8_lossy(&body).into_owned(),
            Some(STANDARD.encode(&body)),
        ),
    };

    Ok(NetResponse {
        status: response.status().as_u16(),
        url: response.get_uri().to_string(),
        headers: response
            .headers()
            .iter()
            .map(|(name, value)| {
                (
                    name.as_str().to_string(),
                    value.to_str().unwrap_or("").to_string(),
                )
            })
            .collect(),
        body,
        body_b64,
    })
}

/// Turn a ureq error into ours, recovering the denial the resolver encoded.
fn map_ureq_error(err: Error) -> NetError {
    match &err {
        Error::BadUri(message) if message.starts_with(DENIED) => {
            NetError::Denied(message[DENIED.len()..].to_string())
        }
        Error::BadUri(message) => NetError::BadUri(message.clone()),
        Error::HostNotFound => NetError::HostNotFound,
        Error::TooManyRedirects => NetError::TooManyRedirects,
        Error::Timeout(_) => NetError::Timeout,
        _ => NetError::Transport(err.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_v4_ranges() {
        assert_eq!(classify("127.0.0.1".parse().unwrap()), IpClass::Loopback);
        assert_eq!(classify("0.0.0.0".parse().unwrap()), IpClass::Loopback);
        assert_eq!(
            classify("169.254.169.254".parse().unwrap()),
            IpClass::LinkLocal
        );
        assert_eq!(classify("10.1.2.3".parse().unwrap()), IpClass::Private);
        assert_eq!(classify("172.20.0.1".parse().unwrap()), IpClass::Private);
        assert_eq!(classify("172.32.0.1".parse().unwrap()), IpClass::Public);
        assert_eq!(classify("192.168.1.1".parse().unwrap()), IpClass::Private);
        assert_eq!(classify("203.0.113.5".parse().unwrap()), IpClass::Synthetic);
        assert_eq!(classify("8.8.8.8".parse().unwrap()), IpClass::Public);
    }

    #[test]
    fn classifies_v6_ranges() {
        assert_eq!(classify("::1".parse().unwrap()), IpClass::Loopback);
        assert_eq!(
            classify("fe80::1".parse().unwrap()),
            IpClass::LinkLocal
        );
        assert_eq!(classify("fd00::1".parse().unwrap()), IpClass::Private);
        assert_eq!(
            classify("2001:db8::1".parse().unwrap()),
            IpClass::Synthetic
        );
        assert_eq!(classify("2606:4700::1".parse().unwrap()), IpClass::Public);
    }

    #[test]
    fn v4_mapped_addresses_are_v4() {
        // The metadata endpoint spelled as IPv6 must still be link-local.
        assert_eq!(
            classify("::ffff:169.254.169.254".parse().unwrap()),
            IpClass::LinkLocal
        );
        assert_eq!(
            classify("::ffff:127.0.0.1".parse().unwrap()),
            IpClass::Loopback
        );
    }

    #[test]
    fn metadata_is_always_denied() {
        let policy = NetPolicy::default();
        assert!(policy
            .check("169.254.169.254".parse().unwrap())
            .is_err());
        // Even an instance allowed onto loopback and private ranges cannot
        // reach link-local.
        let lax = NetPolicy {
            allow_loopback: true,
            allow_private: true,
            ..NetPolicy::default()
        };
        assert!(lax.check("169.254.0.1".parse().unwrap()).is_err());
    }

    #[test]
    fn loopback_needs_an_opt_in() {
        let policy = NetPolicy::default();
        assert!(policy.check("127.0.0.1".parse().unwrap()).is_err());
        let lax = NetPolicy {
            allow_loopback: true,
            ..NetPolicy::default()
        };
        assert!(lax.check("127.0.0.1".parse().unwrap()).is_ok());
    }

    #[test]
    fn parses_virtual_hosts() {
        let table = HostsTable::parse(
            "# the instance's own name space\n\
             127.0.0.1 localhost\n\
             ::1 localhost ip6-localhost\n\
             203.0.113.5 svc.example  # trailing comment\n",
        );
        assert_eq!(
            table.lookup("localhost"),
            Some("127.0.0.1".parse().unwrap())
        );
        assert_eq!(
            table.lookup("SVC.Example"),
            Some("203.0.113.5".parse().unwrap())
        );
        assert!(table.lookup("unknown.example").is_none());
    }

    #[test]
    fn first_hosts_entry_wins() {
        let table = HostsTable::parse("203.0.113.5 a\n10.0.0.1 a\n");
        assert_eq!(table.lookup("a"), Some("203.0.113.5".parse().unwrap()));
    }
}
