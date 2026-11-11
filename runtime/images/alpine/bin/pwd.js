// `pwd`, as a BusyBox applet: the shim stands in for the symlink a real
// filesystem would carry from /bin/pwd to /bin/busybox. The implementation
// is the one binary every applet shares, reached by name.
module.exports = { main: (args) => require("/usr/lib/busybox/applets.js").pwd(args) };
