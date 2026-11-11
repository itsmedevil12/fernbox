// Network denials that need no server: each fetch must be refused before any
// connection is attempted, so the run is hermetic.
//
// Under the default policy loopback and private ranges are denied, DNS is
// offline, and the metadata address is never reachable. Every probe here
// should throw; the script reports the reasons it saw so a regression shows
// which one slipped through.
const results = {};

const attempt = (name, fn) => {
  try {
    results[name] = "escaped: " + JSON.stringify(fn());
  } catch (e) {
    results[name] = e.message;
  }
};

// The cloud metadata endpoint, by name and by IP. Neither is in the image's
// hosts file, so the name is unknown and the IP is refused at connect time.
attempt("metadata-by-ip", () => fernbox.http.fetch("http://169.254.169.254/latest/meta-data/"));
attempt("metadata-by-name", () => fernbox.http.fetch("http://metadata.google.internal/"));
// localhost resolves from the base image to 127.0.0.1, which the default
// policy refuses — the sandbox must not reach the daemon's control socket.
attempt("loopback", () => fernbox.http.fetch("http://localhost/"));
// A name the instance never declared. With DNS offline there is nothing to
// ask, so this is "not found", not "not allowed".
attempt("unknown-host", () => fernbox.http.fetch("http://example.com/"));
// The instance may map a name to a synthetic address, which is reserved for
// virtual services that have no backing server — so it is refused too.
attempt("synthetic-host", () => {
  fernbox.write("/etc/hosts", "203.0.113.5 virtual.local\n");
  return fernbox.http.fetch("http://virtual.local/");
});

const escaped = Object.entries(results).filter(([, v]) => !v.startsWith("denied") && !v.startsWith("host not found"));

JSON.stringify({ escaped, results }, null, 1);
